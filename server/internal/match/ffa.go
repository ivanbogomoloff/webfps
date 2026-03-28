package match

type EndReason string

const (
	EndReasonFragLimit EndReason = "frag_limit"
	EndReasonTimeLimit EndReason = "time_limit"
)

type ScoreEntry struct {
	PlayerID string `json:"playerId"`
	Nickname string `json:"nickname"`
	Frags    int    `json:"frags"`
	Deaths   int    `json:"deaths"`
}

type EvaluateInput struct {
	FragLimit  int
	TimeLeft   int
	Scoreboard []ScoreEntry
}

type EvaluateResult struct {
	Ended    bool
	Reason   EndReason
	WinnerID string
}

// EvaluateEnd checks FFA end conditions:
// 1) any player reaching fragLimit
// 2) timer reaching zero, winner by highest frags.
func EvaluateEnd(in EvaluateInput) EvaluateResult {
	if in.FragLimit > 0 {
		for _, p := range in.Scoreboard {
			if p.Frags >= in.FragLimit {
				return EvaluateResult{
					Ended:    true,
					Reason:   EndReasonFragLimit,
					WinnerID: p.PlayerID,
				}
			}
		}
	}

	if in.TimeLeft <= 0 {
		maxFrags := -1
		winner := ""
		for _, p := range in.Scoreboard {
			if p.Frags > maxFrags {
				maxFrags = p.Frags
				winner = p.PlayerID
			}
		}
		return EvaluateResult{
			Ended:    true,
			Reason:   EndReasonTimeLimit,
			WinnerID: winner,
		}
	}

	return EvaluateResult{}
}
