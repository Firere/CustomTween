# CustomTween
A typed module which allows you to use tweens in Roblox with any easing function. It tries to behave as closely as possible to the behaviour of regular [`Tween`](https://create.roblox.com/docs/reference/engine/classes/Tween)s, including implementing the same methods and [`PlaybackState`](https://create.roblox.com/docs/reference/engine/classes/TweenBase#PlaybackState)s.

## Example usage

```ts
import CustomTween from "@firere/custom-tween";

const gui = new Instance("ScreenGui");
const box = new Instance("Frame");
box.Size = UDim2.fromOffset(100, 100);
box.Parent = gui;
gui.Parent = Players.LocalPlayer.FindFirstChild("PlayerGui") as PlayerGui;

const tween = new CustomTween(box, { time: 5, easing: (x) => 1 - math.pow(1 - x, 5) },  { Position: UDim2.fromScale(1, 0) });

tween.Play();
task.wait(2.5);
tween.Cancel();
```
