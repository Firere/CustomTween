# bezier-tween
A typed module which allows you to use cubic Bezier tweens in Roblox. It tries to behave as closely as possible to the behaviour of regular [`Tween`](https://create.roblox.com/docs/reference/engine/classes/Tween)s, including implementing the same methods and [`PlaybackState`](https://create.roblox.com/docs/reference/engine/classes/TweenBase#PlaybackState)s.

## Example usage

```ts
const gui = new Instance("ScreenGui");
const box = new Instance("Frame");
box.Parent = gui;
gui.Parent = Players.LocalPlayer.FindFirstChild("PlayerGui") as PlayerGui;

const tween = new BezierTween([0.25, 0.1, 0.25, 1])
```
