import Bezier from "@rbxts/cubic-bezier";
import { RunService, TweenService } from "@rbxts/services";

type Properties<T extends Instance> = Partial<ExtractMembers<T, Tweenable>>;

export default class BezierTween<T extends Instance> {
	private bezier: Bezier;
	private delay: number;
	private end: Properties<T>;
	private initial: Properties<T> = {};
	private progress = 0;
	private precision: number;
	private time: number;
	private total = 0;
	private tweenTime: number;
	public connection?: RBXScriptConnection;
	public Instance: T;
	public PlaybackState: Enum.PlaybackState = Enum.PlaybackState.Begin;

	constructor(
		bezier: Bezier | [x1: number, y1: number, x2: number, y2: number],
		instance: T,
		time: number,
		endProperties: Properties<T>,
		delay = 0,
		precision = 100,
	) {
		this.bezier = typeIs(bezier, "function") ? bezier : new Bezier(...bezier);
		this.Instance = instance;
		this.time = time;
		this.end = endProperties;
		this.delay = delay < 0 ? error("Delay cannot be negative") : delay;
		this.precision = precision;
		this.tweenTime = this.time / this.precision;

		for (const [property, _] of pairs(endProperties as object))
			this.initial[property as never] = instance[property as never];
	}

	private getCurrentProperties(progress: number) {
		const lerp = (a: number, b: number) => a + progress * (b - a);
		const Lerp = <T extends { Lerp: (this: T, b: T, progress: number) => T }>(a: T, b: T) => a.Lerp(b, progress);

		const current: Properties<T> = {};
		for (const [k, endSetting] of pairs(this.end as object)) {
			const property = k as keyof Properties<T>;
			const initialSetting = this.initial[property];

			if (["CFrame", "Color3", "UDim2", "Vector2", "Vector3"].includes(typeOf(endSetting))) {
				current[property] = Lerp(initialSetting as never, endSetting as never);
				continue;
			}

			current[property] = {
				number: lerp(initialSetting as number, endSetting as number),
				boolean: progress === 1 ? endSetting : initialSetting,
				Rect: new Rect(
					Lerp((initialSetting as Rect).Min, (endSetting as Rect).Min),
					Lerp((initialSetting as Rect).Max, (endSetting as Rect).Max),
				),
				UDim: new UDim(
					lerp((initialSetting as UDim).Scale, (endSetting as UDim).Scale),
					lerp((initialSetting as UDim).Offset, (endSetting as UDim).Offset),
				),
				Vector2int16: new Vector2int16(
					lerp((initialSetting as Vector2int16).X, (endSetting as Vector2int16).X),
					lerp((initialSetting as Vector2int16).Y, (endSetting as Vector2int16).Y),
				),
			}[typeOf(endSetting) as never];
		}

		return current;
	}

	private reset() {
		for (const [property, setting] of pairs(this.initial as object))
			this.Instance[property as never] = setting as never;
	}

	public Cancel() {
		this.PlaybackState = Enum.PlaybackState.Cancelled;
		this.connection?.Disconnect();
		this.progress = 0;
		this.total = 0;
		this.reset();
	}

	public Pause() {
		if (
			this.PlaybackState === Enum.PlaybackState.Begin ||
			this.PlaybackState === Enum.PlaybackState.Cancelled ||
			this.PlaybackState === Enum.PlaybackState.Completed ||
			this.PlaybackState === Enum.PlaybackState.Delayed
		)
			return;
		this.PlaybackState = Enum.PlaybackState.Paused;
		this.connection?.Disconnect();
		this.total = 0;
	}

	public Play() {
		if (this.PlaybackState === Enum.PlaybackState.Playing || this.PlaybackState === Enum.PlaybackState.Delayed)
			return;

		task.spawn(() => {
			if (this.delay > 0) {
				this.PlaybackState = Enum.PlaybackState.Delayed;
				task.wait(this.delay);
			}

			this.PlaybackState = Enum.PlaybackState.Playing;

			this.connection = RunService.Heartbeat.Connect((deltaTime) => {
				this.total += deltaTime;
				if (this.progress > this.precision) {
					this.PlaybackState = Enum.PlaybackState.Completed;
					return;
				}

				while (this.total >= this.tweenTime) {
					this.total -= this.tweenTime;
					TweenService.Create(
						this.Instance,
						new TweenInfo(this.tweenTime, Enum.EasingStyle.Linear),
						this.getCurrentProperties(this.bezier(this.progress / this.precision)),
					).Play();
					this.progress++;
				}
			});
		});
	}
}
