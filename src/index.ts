import Bezier from "@rbxts/cubic-bezier";
import { RunService, TweenService } from "@rbxts/services";

type Properties<T extends Instance> = Partial<ExtractMembers<T, Tweenable>>;

export interface BezierTweenInfo {
	/** The amount of time the tween takes in seconds. */
	time?: number;
	/** The rate at which the tween progresses. */
	bezier: Bezier | [x1: number, y1: number, x2: number, y2: number];
	/** The number of times the tween repeats after tweening once. */
	repeatCount?: number;
	/** Whether or not the tween does the reverse tween once the initial tween completes. */
	reverses?: boolean;
	/** The amount of time that elapses before tween starts in seconds. */
	delayTime?: number;
}

export default class BezierTween<T extends Instance> {
	private active = true;
	private bezier: Bezier;
	private delay: number;
	private targetProperties: Properties<T>;
	private initial: Properties<T> = {};
	private progress = 0;
	private precision: number;
	private repeatsRemaining = 1;
	private reverses: boolean;
	private reversing = false;
	private time: number;
	private timeElapsed = 0;
	private tweenTime: number;
	public connection?: RBXScriptConnection;
	public Instance: T;
	public PlaybackState: Enum.PlaybackState = Enum.PlaybackState.Begin;

	/**
	 *
	 * @param instance The `Instance` whose properties are to be tweened.
	 * @param tweenInfo The `BezierTweenInfo` to be used.
	 * @param targetProperties A dictionary of properties, and their target values, to be tweened.
	 * @param precision The number of "keyframes" to produce. The higher this is, the more true to the provided Bezier curve the tween will be - at the expense of performance.
	 */
	constructor(instance: T, tweenInfo: BezierTweenInfo, targetProperties: Properties<T>, precision = 100) {
		const { time, bezier, repeatCount, reverses, delayTime } = tweenInfo;
		this.bezier = typeIs(bezier, "function") ? bezier : new Bezier(...bezier);
		this.Instance = instance;
		this.time = time ?? 1;
		this.targetProperties = targetProperties;
		this.delay = (delayTime ?? 0) < 0 ? error("Delay cannot be negative") : (delayTime ?? 0);
		this.precision = precision;
		this.repeatsRemaining += repeatCount ?? 0;
		this.reverses = reverses ?? false;
		this.tweenTime = this.time / this.precision;

		for (const [property, _] of pairs(targetProperties as object))
			this.initial[property as never] = instance[property as never];
	}

	private getCurrentProperties(progress: number) {
		const lerp = (a: number, b: number) => a + progress * (b - a);
		const Lerp = <T extends { Lerp: (this: T, b: T, progress: number) => T }>(a: T, b: T) => a.Lerp(b, progress);

		const current: Properties<T> = {};
		for (const [k, endSetting] of pairs(this.targetProperties as object)) {
			const property = k as keyof Properties<T>;
			const initialSetting = this.initial[property];

			if (["CFrame", "Color3", "UDim2", "Vector2", "Vector3"].includes(typeOf(endSetting))) {
				current[property] = Lerp(initialSetting as never, endSetting as never);
				continue;
			}

			switch (typeOf(endSetting)) {
				case "number":
					current[property] = lerp(initialSetting as number, endSetting as number) as never;
					break;
				case "boolean":
					current[property] = (progress === 1 ? endSetting : initialSetting) as never;
					break;
				case "Rect":
					current[property] = new Rect(
						Lerp((initialSetting as Rect).Min, (endSetting as Rect).Min),
						Lerp((initialSetting as Rect).Max, (endSetting as Rect).Max),
					) as never;
					break;
				case "UDim":
					current[property] = new UDim(
						lerp((initialSetting as UDim).Scale, (endSetting as UDim).Scale),
						lerp((initialSetting as UDim).Offset, (endSetting as UDim).Offset),
					) as never;
					break;
				case "Vector2int16":
					current[property] = new Vector2int16(
						lerp((initialSetting as Vector2int16).X, (endSetting as Vector2int16).X),
						lerp((initialSetting as Vector2int16).Y, (endSetting as Vector2int16).Y),
					) as never;
			}
		}

		return current;
	}

	public Cancel() {
		if (this.PlaybackState === Enum.PlaybackState.Begin) this.PlaybackState = Enum.PlaybackState.Cancelled;
		this.connection?.Disconnect();
		this.progress = 0;
		this.timeElapsed = 0;
		for (const [property, setting] of pairs(this.initial as object))
			this.Instance[property as never] = setting as never;
	}

	public Destroy() {
		this.connection?.Disconnect();
		this.active = false;
	}

	public Pause() {
		if (
			(
				[
					Enum.PlaybackState.Begin,
					Enum.PlaybackState.Cancelled,
					Enum.PlaybackState.Completed,
					Enum.PlaybackState.Delayed,
				] as Enum.PlaybackState[]
			).includes(this.PlaybackState)
		)
			return;
		this.PlaybackState = Enum.PlaybackState.Paused;
		this.connection?.Disconnect();
		this.timeElapsed = 0;
	}

	public Play() {
		if (!this.active) return;
		if (this.PlaybackState === Enum.PlaybackState.Playing || this.PlaybackState === Enum.PlaybackState.Delayed)
			return;

		task.spawn(() => {
			if (this.delay > 0) {
				this.PlaybackState = Enum.PlaybackState.Delayed;
				task.wait(this.delay);
			}

			this.PlaybackState = Enum.PlaybackState.Playing;

			this.connection = RunService.Heartbeat.Connect((deltaTime) => {
				if (!this.active) return;
				this.timeElapsed += deltaTime;
				if (this.progress > this.precision) {
					if (this.reverses && !this.reversing) {
						this.progress = 0;
						this.reversing = true;
					} else {
						this.connection?.Disconnect();
						this.PlaybackState = Enum.PlaybackState.Completed;
						this.progress = 0;
						this.repeatsRemaining -= 1;
						this.reversing = false;
						if (this.repeatsRemaining !== 0) this.Play();
					}
				}

				while (this.timeElapsed >= this.tweenTime) {
					if (this.PlaybackState !== Enum.PlaybackState.Playing || !this.active) return;
					this.timeElapsed -= this.tweenTime;
					const bezier = this.progress / this.precision;
					TweenService.Create(
						this.Instance,
						new TweenInfo(this.tweenTime, Enum.EasingStyle.Linear),
						this.getCurrentProperties(this.bezier(this.reversing ? 1 - bezier : bezier)),
					).Play();
					this.progress++;
				}
			});
		});
	}
}
