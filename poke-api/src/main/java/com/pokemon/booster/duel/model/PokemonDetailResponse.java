package com.pokemon.booster.duel.model;

import java.util.List;
import java.util.Map;

public class PokemonDetailResponse {
    public Integer id;
    public String name;
    public Integer height;
    public Integer weight;
    public Integer base_experience;
    public Integer pokemon_species_id;
    
    // details
    public Boolean is_legendary;
    public Boolean is_mythical;
    public Boolean is_baby;
    public Integer capture_rate;
    public Integer base_happiness;
    
    public String color_name;
    public String shape_name;
    
    public List<Map<String, Object>> types;
    public List<Map<String, Object>> stats;
    public List<Map<String, Object>> abilities;

    public String image;
    public String cry;

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object obj) {
        return (obj instanceof Map) ? (Map<String, Object>) obj : null;
    }

    private String firstUrl(Object value) {
        if (value instanceof String s) {
            return s.matches("^https?:\\/\\/.+") ? s : null;
        } else if (value instanceof List<?> list) {
            for (Object v : list) {
                String found = firstUrl(v);
                if (found != null) return found;
            }
        } else if (value instanceof Map<?, ?> map) {
            for (Object v : map.values()) {
                String found = firstUrl(v);
                if (found != null) return found;
            }
        }
        return null;
    }

    public String pickImage(Object sprites) {
        if (!(sprites instanceof Map)) return null;
        Map<String, Object> map = (Map<String, Object>) sprites;

        Map<String, Object> other = asMap(map.get("other"));
        if (other != null) {
            // sprites.other?.['official-artwork']?.front_default
            Map<String, Object> officialArtwork = asMap(other.get("official-artwork"));
            if (officialArtwork != null && officialArtwork.get("front_default") != null) {
                return String.valueOf(officialArtwork.get("front_default"));
            }

            // sprites.other?.home?.front_default
            Map<String, Object> home = asMap(other.get("home"));
            if (home != null && home.get("front_default") != null) {
                return String.valueOf(home.get("front_default"));
            }
        }

        // sprites.front_default
        if (map.get("front_default") != null) {
            return String.valueOf(map.get("front_default"));
        }

        return firstUrl(sprites);
    }

    public String pickCry(Object cries) {
        if (!(cries instanceof Map)) return null;
        Map<String, Object> map = (Map<String, Object>) cries;

        // cries.latest ?? cries.legacy ?? firstUrl(cries)
        if (map.get("latest") != null) return String.valueOf(map.get("latest"));
        if (map.get("legacy") != null) return String.valueOf(map.get("legacy"));
        
        return firstUrl(cries);
    }
}
