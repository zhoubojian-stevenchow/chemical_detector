import type { ChapterDef, LevelDef } from './types';

export const CHAPTERS: ChapterDef[] = [
  { id: 1, name: 'Kitchen Chaos', subtitle: 'Neighbours with mystery jars', starsToUnlock: 0, color: '#ff9f43', icon: 'home' },
  { id: 2, name: 'Police Precinct', subtitle: 'Crime scenes & donut crumbs', starsToUnlock: 14, color: '#4b7bec', icon: 'badge' },
  { id: 3, name: 'Food & Drug Authority', subtitle: 'Fake honey, fake oil, fake everything', starsToUnlock: 34, color: '#26de81', icon: 'apple' },
  { id: 4, name: 'Industrial Mayhem', subtitle: 'Barrels, gases & shiny rocks', starsToUnlock: 54, color: '#fd9644', icon: 'gear' },
  { id: 5, name: 'Environmental Agency', subtitle: 'Rivers, air & suspicious fish', starsToUnlock: 76, color: '#20bf6b', icon: 'leaf' },
  { id: 6, name: 'Top Secret Lab', subtitle: 'Aliens, astronauts & a mad scientist', starsToUnlock: 98, color: '#a55eea', icon: 'secret' },
];

const L = (
  id: number,
  title: string,
  blurb: string,
  cases: string[],
  size: number,
  mods: LevelDef['mods'] = [],
  timeMul = 1,
): LevelDef => ({ id, chapter: Math.ceil(id / 10), title, blurb, cases, size, mods, timeMul });

export const LEVELS: LevelDef[] = [
  // ── Chapter 1 ──
  L(1, 'First Day Jitters', 'Welcome to Sniff & Co.! Your first client is a sweet old lady with a mystery bottle.', ['c1_cleaner'], 3, [], 2.2),
  L(2, 'Follow Your Nose', 'New tool: your NOSE. Wafting is an art. A smelly art.', ['c1_jug', 'c1_potion'], 3, [], 1.9),
  L(3, 'Feel the Burn', 'The Bunsen burner is lit! Metals paint flames in pretty colours.', ['c1_chef_powder', 'c1_cleaner'], 3, [], 1.7),
  L(4, 'Salt of the Earth', 'Gym bros and chefs. Two groups who take powder VERY seriously.', ['c1_chad_supp', 'c1_chef_powder'], 4, [], 1.6),
  L(5, 'Under the Lens', 'The microscope arrives! Crystals have shapes. Some of them are adorable.', ['c1_timmy_crystals', 'c1_jug'], 4, [], 1.55),
  L(6, 'The HOA Strikes', 'Pam has a binder. Pam has evidence. Pam needs YOU.', ['c1_pam_lawn', 'c1_chef_powder', 'c1_potion'], 4),
  L(7, 'Starch Wars', 'Iodine drops unlocked: anything starchy turns blue-black. Bake-off season begins!', ['c1_grandma_flour', 'c1_timmy_slime'], 4),
  L(8, 'Gym Bros & Grannies', 'Three clients, three mysteries, one very tired lab rat.', ['c1_chad_supp2', 'c1_grandma_pills', 'c1_pam_lawn'], 4),
  L(9, 'Fizz Buzz', 'Acid drops unlocked! Carbonates fizz. You will fizz too, with joy.', ['c1_chef_leaven', 'c1_dave_drain', 'c1_grandma_flour'], 5),
  L(10, 'BOSS: The Great Bake-Off Sabotage', 'Baker Bruno swapped Grandma Edna\'s jars! Expose his floury crimes!', ['c1_bruno_swap', 'c1_grandma_flour', 'c1_bruno_swap', 'c1_beaker_quiz'], 5, ['boss']),
  // ── Chapter 2 ──
  L(11, 'CSI: Kitchen Edition', 'Luminol unlocked: blood glows. Ketchup does not. Usually.', ['c2_redstain', 'c2_powder'], 4),
  L(12, 'Goo Detective', 'Mysterious goo. Mysterious powder. Mysteriously few donuts left.', ['c2_goo', 'c2_powder', 'c2_redstain'], 4),
  L(13, 'Shocking Evidence', 'Conductivity probe unlocked! Salty water zaps, sugary water naps.', ['c2_glass', 'c2_spill'], 4),
  L(14, 'The Donut Incident', 'Someone stole the precinct donuts. Detective Dan is not okay.', ['c2_donut', 'c2_hinge', 'c2_glass'], 5),
  L(15, 'Silver Lining', 'Silver nitrate unlocked! It snitches on chlorides, bromides and iodides.', ['c2_salts', 'c2_moonshine'], 5),
  L(16, 'Moonshine Mayhem', 'RUSH ORDER! The Chief wants answers fast — bonus coins if you deliver.', ['c2_moonshine', 'c2_fireworks', 'c2_redstain'], 5, ['rush']),
  L(17, 'Magnetic Personality', 'Magnet unlocked. Iron things go CLANK. Instant results!', ['c2_metal', 'c2_salts', 'c2_powder'], 4),
  L(18, 'Gala Night', 'Night shift at the Police Gala. The lights are dim and the punch is suspicious.', ['c2_punch', 'c2_fireworks', 'c2_hinge'], 5, ['night']),
  L(19, 'Training Day', 'The Safety Inspector is watching. Only ONE mistake allowed!', ['c2_beaker_quiz', 'c2_glass', 'c2_salts', 'c2_goo'], 5, ['inspector']),
  L(20, 'BOSS: The Great Donut Heist', 'Sneaky Steve is behind it all. Every sample is a lie. Prove it!', ['c2_steve_powder', 'c2_steve_stain', 'c2_donut', 'c2_moonshine'], 6, ['boss']),
  // ── Chapter 3 ──
  L(21, 'Black Light District', 'UV lamp unlocked! Some things glow. It is very disco.', ['c3_tonic', 'c3_seasoning'], 4),
  L(22, 'Oil Be Darned', 'Food fraud season! Olive oil, honey and "pure" vanilla. Trust nothing.', ['c3_oil', 'c3_honey', 'c3_vanilla'], 4),
  L(23, 'Heavy Questions', 'Density scale unlocked! Weigh it to know it.', ['c3_spring', 'c3_tonic'], 5),
  L(24, 'Bee-trayal', 'Somebody is faking Bea\'s honey. The bees want justice. Sticky justice.', ['c3_honey', 'c3_iodised', 'c3_spring'], 5),
  L(25, 'Feeling Blue', 'Sodium hydroxide unlocked: metal ions make colourful gunk.', ['c3_blue', 'c3_bluecrystals', 'c3_seasoning'], 5),
  L(26, 'Got Milk?', 'RUSH ORDER! Dairy panic! The schools need answers before lunch!', ['c3_milk', 'c3_blue', 'c3_oil'], 5, ['rush']),
  L(27, 'Sulfate Showdown', 'Barium chloride unlocked! Sulfates make a thick white cloud.', ['c3_bathsalt', 'c3_iodised'], 6),
  L(28, 'Energy Crisis', 'Night shift. Bolt Bradley has had nine energy drinks. Help him.', ['c3_volt', 'c3_bluecrystals', 'c3_vanilla'], 5, ['night']),
  L(29, 'Spice Rack Scandal', 'Inspector on site. One mistake and the whole shift is cancelled!', ['c3_spice', 'c3_bathsalt', 'c3_milk', 'c3_beaker_quiz'], 5, ['inspector']),
  L(30, 'BOSS: The Counterfeit Cartel', 'Fake honey, fake oil, fake drinks — all from one shady warehouse. Bust it!', ['c3_honey', 'c3_oil', 'c3_blue', 'c3_bathsalt', 'c3_spice'], 6, ['boss']),
  // ── Chapter 4 ──
  L(31, 'Light My Fire', 'Splint test unlocked! Pop = hydrogen. Whoosh = oxygen. Fizzle = boring.', ['c4_gas', 'c4_drain'], 4),
  L(32, 'Pool Party Panic', 'Pete the pool guy has twelve buckets and zero labels.', ['c4_pool', 'c4_hottub', 'c4_gas'], 5),
  L(33, 'Acid Test', 'Battery acid, rust remover, or soda? Mechanic Mo needs to know.', ['c4_acids', 'c4_pool', 'c4_drain'], 5),
  L(34, 'Heavy Metal', 'Rock and roll! Well, rocks. And metals. Minnie struck something.', ['c4_metals', 'c4_acids'], 6),
  L(35, 'Feeling Radiant', 'Geiger counter unlocked! It clicks while you keep testing.', ['c4_rocks', 'c4_counter', 'c4_metals'], 5),
  L(36, 'All That Glitters', 'Jules the jeweller wants to know if it\'s treasure or trash.', ['c4_gold', 'c4_copper', 'c4_counter'], 6),
  L(37, 'Clean-Up Crew', 'RUSH ORDER! The factory needs everything relabelled before the audit.', ['c4_drain', 'c4_blackgoo', 'c4_hottub'], 6, ['rush']),
  L(38, 'Gas Leak!', 'The Bunsen burner is broken — gas safety rules. Use your other tools!', ['c4_gas2', 'c4_purple', 'c4_acids'], 6, ['broken:flame']),
  L(39, 'Solvent Solutions', 'Inspector on site. Wear goggles. Smile. Make no mistakes.', ['c4_solvents', 'c4_beaker_quiz', 'c4_blackgoo', 'c4_metals'], 6, ['inspector']),
  L(40, 'BOSS: Meltdown at the Factory', 'Every barrel at the factory is leaking at once. Foreman Fred is crying into his hard hat.', ['c4_gas2', 'c4_drain', 'c4_acids', 'c4_metals'], 7, ['boss']),
  // ── Chapter 5 ──
  L(41, 'Mass Appeal', 'Mass spectrometer unlocked! It weighs single molecules. Slow but deadly accurate.', ['c5_reservoir', 'c5_cake'], 5),
  L(42, 'Something Fishy', 'The lake smells weird and the fish look worried.', ['c5_lake', 'c5_reservoir', 'c5_fert'], 6),
  L(43, 'Farm Fresh', 'Farmer Fern\'s cows refuse to eat. The cows know something.', ['c5_fert', 'c5_greencrystals', 'c5_cake'], 6),
  L(44, 'Air Quality', 'Invisible enemies! Gases from the plant. Hold your breath.', ['c5_air', 'c5_fert'], 7),
  L(45, 'Mayor\'s Mess', 'RUSH ORDER! The mayor has a photo op in ten minutes.', ['c5_fountain', 'c5_cake', 'c5_air'], 7, ['rush']),
  L(46, 'Pirate Gold', 'Gold bars from a "retired pirate". Arr you sure they\'re real?', ['c5_bars', 'c4_copper', 'c5_fishkill'], 6),
  L(47, 'Toxic Tide', 'Night shift. Something nasty is flowing downstream.', ['c5_fishkill', 'c5_thermo', 'c5_spill'], 7, ['night']),
  L(48, 'Highway to Spill', 'The mass spectrometer is in the shop. Old-school skills only!', ['c5_spill', 'c5_air', 'c5_fountain'], 7, ['broken:massspec']),
  L(49, 'Inspection Day', 'The Inspector is back. One mistake ends the shift.', ['c5_beaker_quiz', 'c5_reservoir', 'c5_spill', 'c5_fert'], 7, ['inspector']),
  L(50, 'BOSS: Something in the River', 'Fish, air, water and a very nervous mayor. Save the town!', ['c5_fishkill', 'c5_spill', 'c5_lake', 'c5_air', 'c5_bars'], 8, ['boss']),
  // ── Chapter 6 ──
  L(51, 'Classified', 'Agent X has clearance for you. And a glowing jar.', ['c6_glow', 'c6_antique', 'c6_radsalt'], 6),
  L(52, 'Space Rocks', 'Astronaut Ava brought souvenirs. Some of them are from space.', ['c6_dust', 'c6_rocks', 'c6_comet'], 6),
  L(53, 'General Confusion', 'General Bluster needs a balloon to float. Or not float. He is unclear.', ['c6_balloon', 'c6_frost', 'c6_radsalt'], 7),
  L(54, 'Close Encounters', 'A real alien walked in. Act natural. Offer it a beaker.', ['c6_zib_goo', 'c6_zorbium', 'c6_dust'], 6),
  L(55, 'Lunch Lockdown', 'RUSH ORDER! The secret agency cafeteria is glowing. Again.', ['c6_cafeteria', 'c6_watch', 'c6_balloon'], 7, ['rush']),
  L(56, 'Mixup\'s Calling Card', 'Professor Mixup has arrived. He swaps labels for fun. FOR FUN.', ['c6_mixup_goo', 'c6_mixup_white'], 7),
  L(57, 'Heavy Evil', 'Night shift. Mixup\'s robot left metal toe-prints everywhere.', ['c6_mixup_metal', 'c6_antique', 'c5_bars'], 7, ['night']),
  L(58, 'Bottled Chaos', 'Mixup sabotaged the mass spectrometer! Rely on your wits.', ['c6_mixup_gas', 'c6_balloon', 'c6_mixup_clear'], 8, ['broken:massspec']),
  L(59, 'Final Exam', 'Dr. Beaker\'s final exam. The Inspector is watching. No pressure.', ['c6_beaker_quiz', 'c6_mixup_clear', 'c6_mixup_white', 'c6_zorbium'], 8, ['inspector']),
  L(60, 'FINALE: Professor Mixup\'s Grand Scheme', 'Every sample in the city has been swapped. Only the best detective in the world can fix this. That\'s you.', ['c6_mixup_white', 'c6_mixup_clear', 'c6_mixup_gas', 'c6_mixup_metal', 'c6_mixup_goo'], 9, ['boss']),
];

export function getLevel(id: number): LevelDef {
  const l = LEVELS[id - 1];
  if (!l) throw new Error(`Unknown level ${id}`);
  return l;
}

export const LEVEL_COUNT = LEVELS.length;
