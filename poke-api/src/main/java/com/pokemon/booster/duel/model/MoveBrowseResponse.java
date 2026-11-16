package com.pokemon.booster.duel.model;

import java.util.List;

public class MoveBrowseResponse {
    public int total;
    public List<MoveItem> items;

    public static class MoveItem {
        public Integer id;
        public String name;
        public Integer power;
        public Integer pp;
        public Integer accuracy;
        public Integer priority;
        public Integer move_effect_chance;
        public Integer pokemon_species_id;
    }
}

