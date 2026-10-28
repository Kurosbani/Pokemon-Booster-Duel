import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

import { sqlQueries, fetchEndpoints } from "./insertData.js";

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: "localhost",
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

const extractIdFromUrl = (url) => {
    const parts = url.split('/').filter(Boolean);
    return parseInt(parts[parts.length - 1], 10);
};

// Helper to split an array into smaller chunks
const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

async function syncPokemonData() { 
    let client;

    const fetchWithRetry = async (url, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                if ('timeout' in controller.signal) controller.signal.timeout = 10_000;
                
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                if (i === retries - 1) throw err;
                
                const wait = Math.min(2000 * Math.pow(2, i), 5000) + Math.random() * 500;
                console.log(`⏳ Retrying ${url} in ${(wait/1000).toFixed(1)}s... (${i+1}/${retries})`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    };

    try {
    client = await pool.connect();
    
    // console.log("Fetching full Pokemon list...");
    // const pokeRes = await fetch(fetchEndpoints.pokemon);
    // const pokeData = await pokeRes.json();
    // const allResults = pokeData.results;

    // const pSpeciesRes = await fetch(fetchEndpoints.pokemonspecies);
    // const pSpeciesData = await pSpeciesRes.json();
    // const allSpeciesResults = pSpeciesData.results;

    // const abilityRes = await fetch(fetchEndpoints.ability);
    // const abilityData = await abilityRes.json();
    // const allAbilityResults = abilityData.results;

    // const moveRes = await fetch(fetchEndpoints.move);
    // const moveData = await moveRes.json();
    // const allMoveResults = moveData.results;

    const moveDCRes = await fetch(fetchEndpoints.movedamageclass);
    const moveDCData = await moveDCRes.json();
    const allMoveDCResults = moveDCData.results;

    // const typeRes = await fetch(fetchEndpoints.type);
    // const typeData = await typeRes.json();
    // const allTypeResults = typeData.results;

    // const genderRes = await fetch(fetchEndpoints.gender);
    // const genderData = await genderRes.json();
    // const allGenderResults = genderData.results;

    // const currencyRes = await fetch(fetchEndpoints.currency);
    // const currencyData = await currencyRes.json();
    // const allCurrencyResults = currencyData.results;

    // const itemCategoryRes = await fetch(fetchEndpoints.itemcategory);
    // const itemCategoryData = await itemCategoryRes.json();
    // const allItemCategoryResults = itemCategoryData.results;

    const itemAttributeRes = await fetch(fetchEndpoints.itemattribute);
    const itemAttributeData = await itemAttributeRes.json();
    const allItemAttributeResults = itemAttributeData.results;

    // const itemRes = await fetch(fetchEndpoints.item);
    // const itemData = await itemRes.json();
    // const allItemResults = itemData.results;

    console.log(`Found ${allMoveDCResults.length} total items. Processing in batches...`);

    const BATCH_SIZE = 20;
    const batches = chunkArray(allMoveDCResults, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Importing batch ${i + 1} of ${batches.length}...`);

        const pokemonDetails = await Promise.all(
            batch.map(p => fetch(p.url).then(res => res.json()))
        );

        const CONCURRENCY = 5;
        const itemDetails = [];

        // for (let i = 0; i < allItemCategoryResults.length; i += CONCURRENCY) {
        //     const batch = await Promise.all(
        //         allItemCategoryResults.slice(i, i + CONCURRENCY).map(s => fetchWithRetry(s.url))
        //     );
        //     itemDetails.push(...batch);
        // }

        // const abilityDetails = await Promise.all(
        //     allAbilityResults.map(a => fetch(a.url).then(res => res.json()))
        // );

        // const moveDetails = await Promise.all(
        //     allMoveResults.map(m => fetch(m.url).then(res => res.json()))
        // );

        // const moveDCDetails = await Promise.all(
        //     allMoveDCResults.map(m => fetch(m.url).then(res => res.json()))
        // );

        // const typeDetails = await Promise.all(
        //     allTypeResults.map(t => fetch(t.url).then(res => res.json()))
        // );

        // const genderDetails = await Promise.all(
        //     allGenderResults.map(g => fetch(g.url).then(res => res.json()))
        // );

        // const currencyDetails = await Promise.all(
        //     allCurrencyResults.map(g => fetch(g.url).then(res => res.json()))
        // );

        // const itemCategoryDetails = await Promise.all(
        //     allItemCategoryResults.map(g => fetch(g.url).then(res => res.json()))
        // );

        const itemAttributeDetails = await Promise.all(
            allItemCategoryResults.map(g => fetch(g.url).then(res => res.json()))
        );

        // transaction
        await client.query('BEGIN');

        for (const pData of pokemonDetails) {
            // 1. Insert Pokemon
            // await client.query(sqlQueries.pokemon, [
            //     pData.id, 
            //     pData.name, 
            //     pData.order,
            //     pData.height, 
            //     pData.weight, 
            //     pData.base_experience,
            //     pData.is_default,
            //     extractIdFromUrl(pData.species.url)
            // ]);

            // // 2. Insert Abilities
            // for (const ab of abilityDetails) {
            //     const generationId = extractIdFromUrl(ab.generation.url);                
            //     await client.query(sqlQueries.ability, [
            //         ab.id, 
            //         ab.name, 
            //         ab.is_main_series,
            //         generationId,
            //     ]);
            // }            
                
            // // 23. Insert PokemonAbilities
            // for (const pab of pData.abilities) {
            //     const abilityId = extractIdFromUrl(pab.ability.url);
            //     await client.query(sqlQueries.pokemonability, [
            //         pab.is_hidden, 
            //         pab.slot, 
            //         abilityId,
            //         pData.id
            //     ]);
            // }

            // 67. Insert Species
            // for (const spData of speciesDetails) {
            //     await client.query(sqlQueries.pokemonspecies, [
            //         spData.id,
            //         spData.name, 
            //         spData.order, 
            //         spData.gender_rate,
            //         spData.capture_rate,
            //         spData.base_happiness,
            //         spData.is_baby,
            //         spData.hatch_counter,
            //         spData.has_gender_differences,
            //         spData.forms_switchable,
            //         spData.evolution_chain_id,
            //         spData.evolves_from_species_id,
            //         spData.generation_id,
            //         spData.growth_rate_id,
            //         spData.pokemon_color_id,
            //         spData.pokemon_habitat_id,
            //         spData.pokemon_shape_id,
            //         spData.is_legendary,
            //         spData.is_mythical
            //     ]);
            // }

            // for (const mv of moveDetails) {
            //     await client.query(sqlQueries.move,[
            //         mv.id,
            //         mv.name,
            //         mv.power,
            //         mv.pp,
            //         mv.accuracy,
            //         mv.priority,
            //         mv.effect_chance,
            //         mv.generation ? extractIdFromUrl(mv.generation.url) : null,
            //         mv.damage_class ? extractIdFromUrl(mv.damage_class.url) : null,
            //         mv.target ? extractIdFromUrl(mv.target.url) : null,
            //         mv.type ? extractIdFromUrl(mv.type.url) : null,
            //         mv.contest_effect ? extractIdFromUrl(mv.contest_effect.url) : null,
            //         mv.contest_type ? extractIdFromUrl(mv.contest_type.url) : null,
            //         mv.super_contest_effect ? extractIdFromUrl(mv.super_contest_effect.url) : null
            //     ]);
            // }

            for (const mvdc of moveDCDetails) {
                await client.query(sqlQueries.movedamageclass,[
                    mvdc.id,
                    mvdc.name
                ]);
            }

            // for (const tp of typeDetails) {
            //     await client.query(sqlQueries.type,[
            //         tp.id,
            //         tp.name,
            //         tp.move_damage_class  ? extractIdFromUrl(tp.move_damage_class.url) : null
            //     ]);
            // }

            // for (const gd of genderDetails) {
            //     await client.query(sqlQueries.gender,[
            //         gd.id,
            //         gd.name
            //     ]);
            // }

            // for (const cc of currencyDetails) {
            //     await client.query(sqlQueries.currency,[
            //         cc.id,
            //         cc.name
            //     ]);
            // }

            // for (const itemC of itemCategoryDetails) {
            //     await client.query(sqlQueries.itemcategory,[
            //         itemC.id,
            //         itemC.name,
            //         itemC.pocket ? extractIdFromUrl(itemC.pocket.url) : null
            //     ])
            // }

            for (const itemC of itemAttributeDetails) {
                await client.query(sqlQueries.itemattribute,[
                    itemC.id,
                    itemC.name
                ])
            }

            // for (const item of itemDetails) {
            //     await client.query(sqlQueries.item,[
            //         item.id,
            //         item.name,
            //         item.fling_power,
            //         item.category ? extractIdFromUrl(item.category.url) : null,
            //         item.fling_effect ? extractIdFromUrl(item.fling_effect.url) : null
            //     ])
            // }

            // Insert all the others... :wsd: :unamused:
        }
    }
        await client.query('COMMIT');
    
    console.log("Full sync complete!");

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error saving data:', error);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

syncPokemonData();