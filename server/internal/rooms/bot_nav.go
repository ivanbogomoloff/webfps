package rooms

import (
	"math"
	"math/rand"
)

type BotWaypoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type BotNavEdge struct {
	From   int     `json:"from"`
	To     int     `json:"to"`
	Weight float64 `json:"weight"`
}

type BotNavGraph struct {
	MapID     string
	Waypoints []BotWaypoint
	Edges     []BotNavEdge
}

func distance3Bot(ax, ay, az, bx, by, bz float64) float64 {
	dx := ax - bx
	dy := ay - by
	dz := az - bz
	return math.Sqrt(dx*dx + dy*dy + dz*dz)
}

func findNearestWaypointIndex(nav *BotNavGraph, x, y, z float64) int {
	if nav == nil || len(nav.Waypoints) == 0 {
		return 0
	}
	best := 0
	bestDist := math.Inf(1)
	for i, wp := range nav.Waypoints {
		dist := distance3Bot(x, y, z, wp.X, wp.Y, wp.Z)
		if dist < bestDist {
			bestDist = dist
			best = i
		}
	}
	return best
}

func pickRandomWaypointIndex(nav *BotNavGraph, exclude int, rng *rand.Rand) int {
	if nav == nil || len(nav.Waypoints) == 0 {
		return 0
	}
	if len(nav.Waypoints) == 1 {
		return 0
	}
	index := rng.Intn(len(nav.Waypoints))
	if index == exclude {
		index = (index + 1) % len(nav.Waypoints)
	}
	return index
}

func botFindPath(nav *BotNavGraph, fromIndex, toIndex int) []int {
	if nav == nil || len(nav.Waypoints) == 0 {
		return nil
	}
	if fromIndex == toIndex {
		return []int{fromIndex}
	}
	if fromIndex < 0 || toIndex < 0 || fromIndex >= len(nav.Waypoints) || toIndex >= len(nav.Waypoints) {
		return nil
	}

	adj := make([][]struct {
		to     int
		weight float64
	}, len(nav.Waypoints))
	for _, edge := range nav.Edges {
		if edge.From < 0 || edge.To < 0 || edge.From >= len(nav.Waypoints) || edge.To >= len(nav.Waypoints) {
			continue
		}
		adj[edge.From] = append(adj[edge.From], struct {
			to     int
			weight float64
		}{edge.To, edge.Weight})
		adj[edge.To] = append(adj[edge.To], struct {
			to     int
			weight float64
		}{edge.From, edge.Weight})
	}

	openSet := map[int]bool{fromIndex: true}
	cameFrom := map[int]int{}
	gScore := map[int]float64{fromIndex: 0}
	fScore := map[int]float64{
		fromIndex: distance3Bot(
			nav.Waypoints[fromIndex].X, nav.Waypoints[fromIndex].Y, nav.Waypoints[fromIndex].Z,
			nav.Waypoints[toIndex].X, nav.Waypoints[toIndex].Y, nav.Waypoints[toIndex].Z,
		),
	}

	for len(openSet) > 0 {
		current := -1
		bestF := math.Inf(1)
		for index := range openSet {
			if f := fScore[index]; f < bestF {
				bestF = f
				current = index
			}
		}
		if current < 0 {
			return nil
		}
		if current == toIndex {
			path := []int{current}
			for path[0] != fromIndex {
				prev, ok := cameFrom[path[0]]
				if !ok {
					break
				}
				path = append([]int{prev}, path...)
			}
			return path
		}
		delete(openSet, current)
		currentG := gScore[current]
		for _, neighbor := range adj[current] {
			tentativeG := currentG + neighbor.weight
			if prev, ok := gScore[neighbor.to]; ok && tentativeG >= prev {
				continue
			}
			cameFrom[neighbor.to] = current
			gScore[neighbor.to] = tentativeG
			wp := nav.Waypoints[neighbor.to]
			target := nav.Waypoints[toIndex]
			fScore[neighbor.to] = tentativeG + distance3Bot(wp.X, wp.Y, wp.Z, target.X, target.Y, target.Z)
			openSet[neighbor.to] = true
		}
	}
	return nil
}

func botSpawnFromNav(nav *BotNavGraph, nearX, nearY, nearZ float64) (float64, float64, float64) {
	if nav == nil || len(nav.Waypoints) == 0 {
		return nearX, nearY, nearZ
	}
	index := findNearestWaypointIndex(nav, nearX, nearY, nearZ)
	wp := nav.Waypoints[index]
	return wp.X, wp.Y, wp.Z
}

func botStepPatrol(nav *BotNavGraph, bot *playerState, dt float64, rng *rand.Rand) {
	if nav == nil || len(nav.Waypoints) == 0 || bot == nil {
		bot.Locomotion = "idle"
		return
	}

	nearest := findNearestWaypointIndex(nav, bot.X, bot.Y, bot.Z)
	if len(bot.BotPath) == 0 || bot.BotPathCursor >= len(bot.BotPath) {
		goal := pickRandomWaypointIndex(nav, bot.BotWaypointIndex, rng)
		bot.BotWaypointIndex = goal
		path := botFindPath(nav, nearest, goal)
		if len(path) == 0 {
			path = []int{goal}
		}
		bot.BotPath = path
		bot.BotPathCursor = 0
	}

	targetIndex := bot.BotPath[bot.BotPathCursor]
	if targetIndex < 0 || targetIndex >= len(nav.Waypoints) {
		bot.BotPath = nil
		bot.BotPathCursor = 0
		return
	}
	target := nav.Waypoints[targetIndex]
	dx := target.X - bot.X
	dz := target.Z - bot.Z
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist <= botArriveRadius {
		if bot.BotPathCursor < len(bot.BotPath)-1 {
			bot.BotPathCursor++
		} else {
			bot.BotPath = nil
			bot.BotPathCursor = 0
		}
		bot.Locomotion = "idle"
		return
	}

	step := math.Min(dist, botMoveSpeed*dt)
	if dist > 1e-6 {
		bot.X += (dx / dist) * step
		bot.Z += (dz / dist) * step
	}
	bot.Y = target.Y
	nextRotY := botYawToward(bot.X, bot.Z, target.X, target.Z)
	vx := (dx / dist) * botMoveSpeed
	vz := (dz / dist) * botMoveSpeed
	bot.RotY = nextRotY
	bot.Locomotion = botLocomotionFromVelocity(nextRotY, vx, vz)
}

func botStepCombatChase(bot *playerState, target *playerState, dt float64) {
	if bot == nil || target == nil {
		return
	}
	bot.RotY = botYawToward(bot.X, bot.Z, target.X, target.Z)
	dx := target.X - bot.X
	dz := target.Z - bot.Z
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist <= botCombatStopDistance {
		bot.Locomotion = botFireLocomotion("idle")
		return
	}
	step := math.Min(dist-botCombatStopDistance, botMoveSpeed*0.85*dt)
	if dist > 1e-6 {
		bot.X += (dx / dist) * step
		bot.Z += (dz / dist) * step
	}
	vx := (dx / dist) * botMoveSpeed * 0.85
	vz := (dz / dist) * botMoveSpeed * 0.85
	bot.Locomotion = botFireLocomotion(botLocomotionFromVelocity(bot.RotY, vx, vz))
}
