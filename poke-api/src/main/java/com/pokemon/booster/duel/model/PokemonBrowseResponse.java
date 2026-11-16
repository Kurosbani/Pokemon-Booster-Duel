package com.pokemon.booster.duel.model;

import java.util.List;

public class PokemonBrowseResponse {
    public int total;
    public List<PokemonItem> items;

    public static class PokemonItem {
        public Integer id;
        public String name;
        public Integer order;
        public Integer height;
        public Integer weight;
        public Integer base_experience;
        public Boolean is_default;
    }
}