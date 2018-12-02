Ludum Dare 43 - TBD
============================

LD43 Entry by Jimbly

* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/turbulenz-playground)

Start with: `npm start` (after running `npm i` once)

TODO:
* Potion order requirements are a bit high too quickly? Especially Pure of 16!
  * 10 of each (5 turns minimum) is probably a more reasonable max
* Need more diminishing returns when feeding pets - feeding a S=8 pet a S=2 potion should not still add 2!  (Fractional, but hidden?)
  * Or, diminishing return is when harvesting for ingredients, yeah.

* High scores
* Would be useful to see current stats of all potions (and pets) - roll over something and they all show up? Always there? Hold shift?
* Pets grow in size after being fed?  Or their size is fixed?
* New button and panel graphics
* Allow selecting pet first, then food, show same tooltip
* Daily summary if things go wrong
* Shadows under pets
* Animate pets
* More pet variety and size variety
* Pets wander when mouse not near them
* How many count taps for source values - maybe should be divided by 2, as one tap can fill all 6 bottles sometimes!
* Gears or pattern in background of pipes board
* Animate pipes rotating
* Separate seeded random for orders for consistency

Alchemical Menagerie
* Art
** Bottles
** Pipes
** Critters
** 3 attribute icons
** 2 tapability icons?
* Mechanics
** Pipe Dreams
*** Generate board that's guaranteed to make a few paths (generate 3 paths, then rotate, than fill in random? just do random and see how it goes?)
*** Allow dragging of creatures to taps
*** Button to clear individual taps - no, just overwrite
*** Show how much is left in each tap
*** Show current results
*** Quick animation up clicking Brew
*** Drag potions to creatures, trash, or Current Goal
** Creatures
*** Drink potions, stats change
** Current Goals

Critters
* Slug ("Doom Slug"?)
* Beholder
* Dragon
* Gryphon
* Panda
* Krell (shrimp or froglike)
