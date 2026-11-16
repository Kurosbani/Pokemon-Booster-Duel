package com.pokemon.booster.duel.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.pokemon.booster.duel.model.MoveBrowseResponse;
import com.pokemon.booster.duel.model.PokemonBrowseResponse;
import com.pokemon.booster.duel.model.PokemonDetailResponse;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/pokemon")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PokeApiResource {

    @Inject
    EntityManager em;

    // --- Endpoints ---

    @GET
    public List<Map<String, Object>> getAllPokemon() {
        try {
            return em.createNativeQuery("SELECT * FROM pokemon ORDER BY id ASC")
                     .getResultList();
        } catch (Exception e) {
            throw new RuntimeException("Database error", e);
        }
    }

    @Path("/browse")
    @GET
    public PokemonBrowseResponse browsePokemon(
            @QueryParam("limit") Integer limit, 
            @QueryParam("offset") Integer offset, 
            @QueryParam("seed") String seed) {
        
        int lim = Math.min(Math.max(limit != null ? limit : 24, 1), 100);
        int off = Math.max(offset != null ? offset : 0, 0);
        String seedStr = (seed != null && !seed.isEmpty()) ? seed.substring(0, 64) : "";

        StringBuilder sql = new StringBuilder();
        List<Object> params = new java.util.ArrayList<>();

        sql.append("SELECT p.id, p.name, ");
        // Thumbnail subquery from JS
        sql.append("(SELECT COALESCE(s.sprites->'other'->'official-artwork'->>'front_default', s.sprites->>'front_default') FROM pokemonsprites s WHERE s.pokemon_id = p.id LIMIT 1) AS thumbnail, ");
        // Types aggregation from JS
        sql.append("COALESCE((SELECT json_agg(t.name ORDER BY pt.slot) FROM pokemontype pt JOIN type t ON t.id = pt.type_id WHERE pt.pokemon_id = p.id), '[]'::json) AS types, ");
        sql.append("COUNT(*) OVER() AS total ");
        sql.append("FROM pokemon p WHERE p.is_default = true ");

        if (seedStr != null && !seedStr.isEmpty()) {
            sql.append("ORDER BY md5(p.id::text || ?), p.id LIMIT ? OFFSET ?");
            params.add(seedStr);
            params.add(lim);
            params.add(off);
        } else {
            sql.append("ORDER BY p.id LIMIT ? OFFSET ?");
            params.add(lim);
            params.add(off);
        }

        try {
            var query = em.createNativeQuery(sql.toString());
            for (int i = 0; i < params.size(); i++) {
                query.setParameter(i + 1, params.get(i));
            }
            
            List<Object[]> rows = query.getResultList();
            
            if (rows.isEmpty()) {
                return new PokemonBrowseResponse() {{ total = 0; items = java.util.Collections.emptyList(); }};
            }

            int total = ((Number) rows.get(0)[3]).intValue(); // The 'total' column is at index 3
            
            List<PokemonBrowseResponse.PokemonItem> items = rows.stream().skip(off).limit(lim)
                .map(row -> {
                    PokemonBrowseResponse.PokemonItem item = new PokemonBrowseResponse.PokemonItem();
                    item.id = (Integer) row[0];
                    item.name = (String) row[1];
                    return item;
                }).collect(Collectors.toList());

            PokemonBrowseResponse response = new PokemonBrowseResponse();
            response.total = total;
            response.items = items;
            return response;

        } catch (Exception e) {
            throw new RuntimeException("Browse failed", e);
        }
    }

    @Path("/{id}/details")
    @GET
    public PokemonDetailResponse getDetails(@PathParam("id") String idStr) {
        if (!idStr.matches("^\\d+$")) {
            return null; // Or throw 400 error
        }

        int id = Integer.parseInt(idStr);

        try {
            String sql =
            "SELECT p.id, p.name, p.height, p.weight, p.base_experience,\n" +
            "p.pokemon_species_id,\n" +
            "ps.is_legendary, ps.is_mythical, ps.is_baby,\n" +
            "ps.capture_rate, ps.base_happiness,\n" +
            "pc.name AS color,\n" +
            "psh.name AS shape,\n" +
            "COALESCE((\n" +
            "  SELECT json_agg(json_build_object('slot', pt.slot, 'name', t.name) ORDER BY pt.slot)\n" +
            "  FROM pokemontype pt JOIN type t ON t.id = pt.type_id\n" +
            "  WHERE pt.pokemon_id = p.id\n" +
            "), '[]'::json) AS types,\n" +
            "COALESCE((\n" +
            "  SELECT json_agg(json_build_object('name', s.name, 'base_stat', st.base_stat, 'effort', st.effort) ORDER BY s.game_index)\n" +
            "  FROM pokemonstat st JOIN stat s ON s.id = st.stat_id\n" +
            "  WHERE st.pokemon_id = p.id\n" +
            "), '[]'::json) AS stats,\n" +
            "COALESCE((\n" +
            "  SELECT json_agg(json_build_object('name', a.name, 'is_hidden', pa.is_hidden, 'slot', pa.slot) ORDER BY pa.slot)\n" +
            "  FROM pokemonability pa JOIN ability a ON a.id = pa.ability_id\n" +
            "  WHERE pa.pokemon_id = p.id\n" +
            "), '[]'::json) AS abilities,\n" +
            "(SELECT s.sprites FROM pokemonsprites s WHERE s.pokemon_id = p.id LIMIT 1) AS sprites,\n" +
            "(SELECT c.cries FROM pokemoncries c WHERE c.pokemon_id = p.id LIMIT 1) AS cries\n" +
            "FROM pokemon p\n" +
            "LEFT JOIN pokemonspecies ps ON ps.id = p.pokemon_species_id\n" +
            "LEFT JOIN pokemoncolor pc ON pc.id = ps.pokemon_color_id\n" +
            "LEFT JOIN pokemonshape psh ON psh.id = ps.pokemon_shape_id\n" +
            "WHERE p.id = ?1";

            @SuppressWarnings("unchecked")
            List<Object[]> result = em.createNativeQuery(sql).setParameter(1, id).getResultList();

            if (result.isEmpty()) {
                return null; 
            }

            Object[] row = result.get(0);
            
            PokemonDetailResponse resp = new PokemonDetailResponse();
            resp.id = (Integer) row[0];
            resp.name = (String) row[1];
            resp.height = (Integer) row[2];
            resp.weight = (Integer) row[3];
            resp.base_experience = (Integer) row[4];
            resp.pokemon_species_id = (Integer) row[5];
            
            Object isLegendaryObj = row[6];
            resp.is_legendary = isLegendaryObj != null ? (Boolean) isLegendaryObj : false;
            resp.is_mythical = row[7] != null && (Boolean) row[7];
            resp.is_baby = row[8] != null && (Boolean) row[8];
            resp.capture_rate = row[9] != null ? (Integer) row[9] : 0;
            resp.base_happiness = row[10] != null ? (Integer) row[10] : 0;

            resp.color_name = (String) row[11];
            resp.shape_name = (String) row[12];

            resp.types = parseJsonArray(row[13]); 
            resp.stats = parseJsonArray(row[14]);
            resp.abilities = parseJsonArray(row[15]);

            Object spritesObj = row[16];
            Object criesObj = row[17];

            resp.image = resp.pickImage(spritesObj);
            resp.cry   = resp.pickCry(criesObj);

            return resp;

        } catch (Exception e) {
            throw new RuntimeException("Detail lookup failed", e);
        }
    }

    @Path("/{value}")
    @GET
    public List<Map<String, Object>> searchPokemon(@PathParam("value") String query, 
                                                   @QueryParam("limit") Integer limit, 
                                                   @QueryParam("offset") Integer offset,
                                                   @QueryParam("sort") String sort) {
        
        int lim = Math.min(Math.max(limit != null ? limit : 50, 1), 100);
        int off = Math.max(offset != null ? offset : 0, 0);
        String sortField = (sort != null && (sort.equals("id") || sort.equals("name"))) ? sort : "id";

        try {
            StringBuilder sql = new StringBuilder();
            List<Object> params = new java.util.ArrayList<>();

            sql.append("SELECT p.id, p.name, (SELECT s.sprites->>'front_default' FROM pokemonsprites s WHERE s.pokemon_id = p.id LIMIT 1) AS thumbnail FROM pokemon p WHERE p.is_default = true ");

            if (query.matches("^\\d+$")) {
                sql.append("AND p.id = ? ORDER BY p.").append(sortField).append(" ASC LIMIT ? OFFSET ?");
                params.add(Integer.parseInt(query));
                params.add(lim);
                params.add(off);
            } else {
                String escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                sql.append("AND p.name ILIKE ? ORDER BY p.").append(sortField).append(" ASC LIMIT ? OFFSET ?");
                params.add("%" + escaped + "%");
                params.add(lim);
                params.add(off);
            }

            var q = em.createNativeQuery(sql.toString());
            for (int i = 0; i < params.size(); i++) {
                q.setParameter(i + 1, params.get(i));
            }
            
            @SuppressWarnings("unchecked")
            List<Object[]> rawRows = q.getResultList();

            // Convert to Map<String, Object> list manually if you want clean JSON output
            String[] cols = {"id", "name", "thumbnail"};
            return rawRows.stream().map(row -> {
                java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
                for(int i=0; i<cols.length; i++) map.put(cols[i], row[i]);
                return map;
            }).collect(Collectors.toList());

        } catch (Exception e) {
            throw new RuntimeException("Search failed", e);
        }
    }

    @Path("/moves")
    @GET
    public MoveBrowseResponse browseMoves(@QueryParam("limit") Integer limit, 
                                          @QueryParam("offset") Integer offset, 
                                          @QueryParam("seed") String seed) {
        
        int lim = Math.min(Math.max(limit != null ? limit : 24, 1), 100);
        int off = Math.max(offset != null ? offset : 0, 0);
        String seedStr = (seed != null && !seed.isEmpty()) ? seed.substring(0, 64) : "";

        StringBuilder sql = new StringBuilder();
        List<Object> params = new java.util.ArrayList<>();

        sql.append("SELECT m.id, m.name, m.power, m.pp, m.accuracy, m.priority, m.move_effect_chance, COUNT(*) OVER() AS total FROM \"move\" m ");

        if (seedStr != null && !seedStr.isEmpty()) {
            sql.append("ORDER BY md5(m.id::text || ?), m.id LIMIT ? OFFSET ?");
            params.add(seedStr);
            params.add(lim);
            params.add(off);
        } else {
            sql.append("ORDER BY m.id LIMIT ? OFFSET ?");
            params.add(lim);
            params.add(off);
        }

        try {
            var query = em.createNativeQuery(sql.toString());
            for (int i = 0; i < params.size(); i++) {
                query.setParameter(i + 1, params.get(i));
            }
            
            List<Object[]> rows = query.getResultList();
            
            if (rows.isEmpty()) {
                return new MoveBrowseResponse() {{ total = 0; items = java.util.Collections.emptyList(); }};
            }

            int total = ((Number) rows.get(0)[7]).intValue(); // Total is at index 7
            
            List<MoveBrowseResponse.MoveItem> items = rows.stream().skip(off).limit(lim)
                .map(row -> {
                    MoveBrowseResponse.MoveItem item = new MoveBrowseResponse.MoveItem();
                    item.id = (Integer) row[0];
                    item.name = (String) row[1];
                    item.power = row[2] != null ? (Integer) row[2] : 0;
                    item.pp = row[3] != null ? (Integer) row[3] : 0;
                    item.accuracy = row[4] != null ? (Integer) row[4] : 0;
                    item.priority = row[5] != null ? (Integer) row[5] : 0;
                    item.move_effect_chance = row[6] != null ? (Integer) row[6] : 0;
                    return item;
                }).collect(Collectors.toList());

            MoveBrowseResponse response = new MoveBrowseResponse();
            response.total = total;
            response.items = items;
            return response;

        } catch (Exception e) {
            throw new RuntimeException("Moves browse failed", e);
        }
    }

    @Path("/move/{id}/details")
    @GET
    public Map<String, Object> getMoveDetails(@PathParam("id") String idStr) {
        if (!idStr.matches("^\\d+$")) return null;

        try {
            List<Object> result = em.createNativeQuery(
                "SELECT m.id, m.name, m.power, m.pp, m.accuracy, m.priority, m.move_effect_chance, m.move_damage_class_id, m.type_id, t.name AS type_name, mc.name AS damage_class_name FROM \"move\" m LEFT JOIN \"type\" t ON t.id = m.type_id LEFT JOIN \"movedamageclass\" mc ON mc.id = m.move_damage_class_id WHERE m.id = ?"
            ).setParameter(1, Integer.parseInt(idStr)).getResultList();

            if (result.isEmpty()) return null;

            Object[] row = (Object[]) result.get(0);
            // Convert to Map for easy JSON serialization
            java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
            String[] cols = {"id", "name", "power", "pp", "accuracy", "priority", "move_effect_chance", "move_damage_class_id", "type_id", "type_name", "damage_class_name"};
            for(int i=0; i<cols.length; i++) {
                map.put(cols[i], row[i]);
            }
            return map;

        } catch (Exception e) {
            throw new RuntimeException("Move lookup failed", e);
        }
    }

    @Path("/{id}/moves")
    @GET
    public List<Map<String, Object>> getPokemonMoves(@PathParam("id") String idStr) {
        if (!idStr.matches("^\\d+$")) return null;

        try {
            List<Object> result = em.createNativeQuery(
                "SELECT m.id AS move_id, m.name AS move_name, m.power, m.pp, m.accuracy, m.priority, MIN(pm.level) AS earliest_level, t.name AS type_name, mc.name AS damage_class_name, json_agg(DISTINCT pm.move_learn_method_id ORDER BY pm.move_learn_method_id) AS learn_methods FROM pokemonmove pm JOIN \"move\" m ON m.id = pm.move_id LEFT JOIN \"type\" t ON t.id = m.type_id LEFT JOIN \"movedamageclass\" mc ON mc.id = m.move_damage_class_id WHERE pm.pokemon_id = ? GROUP BY m.id, m.name, m.power, m.pp, m.accuracy, m.priority, t.name, mc.name ORDER BY earliest_level ASC, m.id ASC"
            ).setParameter(1, Integer.parseInt(idStr)).getResultList();

            if (result.isEmpty()) return java.util.Collections.emptyList();

            String[] cols = {"move_id", "move_name", "power", "pp", "accuracy", "priority", "earliest_level", "type_name", "damage_class_name", "learn_methods"};
            
            // FIX: Cast row to Object[] inside the map function
            return result.stream().map(row -> {
                java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
                Object[] rowData = (Object[]) row; // <--- This fixes the array error
                for(int i=0; i<cols.length; i++) {
                    map.put(cols[i], rowData[i]);
                }
                return map;
            }).collect(Collectors.toList());

        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch pokemon moves", e);
        }
    }


    // Helper to parse JSON strings if Hibernate returns them as Strings instead of Objects
    private List<Map<String, Object>> parseJsonArray(Object obj) {
        if (obj == null) return java.util.Collections.emptyList();
        try {
            // If it's already a List/Map from Hibernate, cast it. 
            // If it's a String (common in native queries), use Jackson to parse.
            if (obj instanceof String s) {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                return mapper.readValue(s, java.util.List.class);
            } else if (obj instanceof List<?> list) {
                // Hibernate often returns List of Maps for JSON arrays in native queries
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> mappedList = (List<Map<String, Object>>) list;
                return mappedList;
            }
        } catch (Exception e) {
            // Fallback
        }
        return java.util.Collections.emptyList();
    }
}
