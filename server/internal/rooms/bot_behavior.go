package rooms

type BotBehavior interface {
	Apply(bot *playerState, room *roomState, nowMs int64)
}

type IdleBotBehavior struct{}

func (IdleBotBehavior) Apply(bot *playerState, _ *roomState, _ int64) {
	if bot == nil {
		return
	}
	bot.Locomotion = "idle"
}
