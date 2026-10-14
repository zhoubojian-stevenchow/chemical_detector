// Gerald the lab rat says things. Many things.

export const GERALD: Record<string, string[]> = {
  shiftStart: [
    'New shift! I have polished every beaker. With my tail.',
    'Remember: we do not lick the samples. I learned that the hard way.',
    'Big day! I can feel it in my whiskers.',
    'Coffee? Check. Goggles? Check. Cheese? …Unrelated, but check.',
    'Let\'s science the heck out of this.',
    'If anything explodes, I was never here.',
  ],
  firstTest: ['Ooh, good choice!', 'Science time!', 'Let\'s see what it does!', 'Go go go!'],
  perfect: ['PERFECT! Gerald approves!', 'Textbook technique!', 'Your hands are smoother than my fur!', 'Chef\'s kiss! *squeak*'],
  miss: ['Oof. Butterfingers.', 'That was… a choice.', 'Shake it off! Try again!', 'Even Marie Curie had off days.'],
  accident: ['MY WHISKERS!', 'I am calling my lawyer. He is also a rat.', 'Days without accident: zero. Again.', 'That is going on the incident board.'],
  sniffBad: ['Your face just turned green.', 'Breathe! Not that! Fresh air!', 'Maybe waft gentler next time?'],
  eliminated: ['Ruled out! Crossing it off.', 'Bye-bye, wrong answers!', 'Narrowing it down!', 'The plot thickens. Like oobleck.'],
  oneLeft: ['Only one left! Tap it and IDENTIFY!', 'There\'s only one suspect remaining…', 'Elementary, my dear scientist!'],
  bold: ['A BOLD CALL! I love it! I hate it! I love it!', 'Guessing early? Brave. Very brave.', 'Fortune favours the bold!'],
  correct: ['NAILED IT!', 'Another happy customer!', 'That\'s my scientist!', 'Ka-ching!'],
  wrong: ['Oh no. Oh no no no.', 'We\'ll pretend that didn\'t happen.', 'The client is… not thrilled.', 'Mistakes are just experiments with feelings.'],
  lowTime: ['The clock! THE CLOCK!', 'Hurry hurry hurry!', 'Faster! My tail is sweating!'],
  idle: ['Psst. Check the cards for clues.', 'Not sure? Tap a card to see what each test would show.', 'The best test splits the suspects in half!', 'Hmm, which tool would rule out the most?'],
  machine: ['The machine is on it! Keep testing!', 'Whirr whirr. Do something else while it runs!'],
  levelWin: ['WE DID IT!', 'Shift complete! Cheese for everyone!', 'Best. Shift. Ever.'],
  levelLose: ['We\'ll get \'em next time.', 'Everyone has bad shifts. Even rats.', 'Deep breaths. Not of the samples.'],
  newTool: ['NEW TOY! I mean, new professional equipment!', 'Shiny! Let\'s break it in!'],
};

export const TIPS = [
  'Tap a substance card to see what each test should show for it.',
  'Pick the test that splits the remaining suspects the most!',
  'Submitting with several suspects left is a BOLD CALL: more coins, more risk.',
  'Machines like the Geiger counter run in the background. Keep testing!',
  'Perfect mini-games in a row build a combo for bonus coins.',
  'Wafting gently keeps your nose (and your hearts) safe.',
  'Flammable samples can catch fire if you botch the flame test.',
  'Upgrades in the shop make tests faster, safer, or automatic.',
  'Rank up to earn skill points. Skills stack with upgrades!',
  'Three stars: finish the shift, make no mistakes, and beat the par time.',
  'Stuck? Lab Notes rule out a wrong answer and point at the best test.',
  'Gerald accepts cheese as payment. He does not accept coins. He tried.',
  'Every new substance you identify goes into your Chem Dex.',
  'Bleach + acid = toxic gas. That\'s not a tip, that\'s a life lesson.',
];

export const LOADING_LINES = [
  'Polishing beakers…',
  'Calibrating Gerald\'s nose…',
  'Labelling the unlabelled…',
  'Hiding the explosive stuff…',
  'Brewing lab coffee…',
  'Counting the atoms…',
];

export const FAIL_REASONS: Record<string, { title: string; text: string }> = {
  time: { title: 'Out of time!', text: 'The clients went home. Some of them left one-star reviews. In crayon.' },
  hearts: { title: 'Sent home!', text: 'Too many mishaps. Dr. Beaker has confiscated your goggles for the day.' },
  inspector: { title: 'Inspection failed!', text: 'The Safety Inspector saw that. The Safety Inspector writes everything down.' },
};

export const MOD_INFO: Record<string, { name: string; desc: string; color: string }> = {
  rush: { name: 'Rush Order', desc: 'Less time, +30% coins', color: '#ff6b6b' },
  inspector: { name: 'Inspector', desc: 'Only 1 heart — no mistakes!', color: '#4b7bec' },
  night: { name: 'Night Shift', desc: 'Lights are dim. +15% coins', color: '#5f27cd' },
  boss: { name: 'Boss Shift', desc: 'Big case, big rewards', color: '#ff9f43' },
  broken: { name: 'Broken Tool', desc: 'One tool is out of service', color: '#8395a7' },
};
