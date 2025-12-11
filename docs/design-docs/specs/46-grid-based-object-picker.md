# 46. Grid-based object picker

Let's update the create object menu.

When you hit 'Enter' it brings up a menu to quickly create objects. The main problem is that it gives you a really long list of sorted object names (e.g. +~, adsr, ai.img, ...).

This is not user friendly at all, because new users won't know 1) which objects does what, 2) what objects they should give a try
first, and 3) how that object visually looks like.

The nice thing about the existing object menu is that it's super fast: object searches, arrow up/down navigation. I want to preserve
 that fast UX.

The new idea is to make it similar to a command palette: search bar at the top for quick navigation, with categories on the left
sidebar so they can go to the right categories (e.g. video, audio), and the grid of objects taking up the rest of the space in
grids.

## Keyboard accessibility

It should remain fast to use and easy to navigate with arrow keys:

- up/down/left/right arrows should work to navigate between items
- when at the topmost grid item, pressing "up" takes you to the search bar. pressing down from the search bar takes you to the grid
area
- when at the leftmost grid item, pressing "left" takes you to the categories sidebar, which you can navigate between categories of
objects. pressing right should take you to the grid view of objects.
