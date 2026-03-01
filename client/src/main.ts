import './main.css'
import * as THREE from 'three'
import { Game } from './game/Game'

// Инициализируем игру
const game = new Game()

// Создаём игроков и тестовые объекты
game.createPlayer()
game.createGround()
game.createTestCube()

// Запускаем игру
game.start()

// Создаём HUD для отладки
const hudElement = document.createElement('div')
hudElement.id = 'hud'
hudElement.style.cssText = `
  position: fixed;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #0f0;
  font-family: monospace;
  padding: 10px;
  border: 1px solid #0f0;
  z-index: 1000;
  font-size: 12px;
  line-height: 1.5;
`
document.body.appendChild(hudElement)

// Обновляем HUD каждый кадр
const updateHUD = () => {
  const world = game.getWorld()
  const player = Array.from(world.entities).find((e: any) => e.playerController)
  
  if (player) {
    const pos = player.transform.position
    const camera = player.camera
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    
    hudElement.innerHTML = `
      <div>POSITION: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}</div>
      <div>ROTATION: ${(euler.y * 180 / Math.PI).toFixed(0)}°, ${(euler.x * 180 / Math.PI).toFixed(0)}°</div>
      <div>MOUSE LOCKED: ${player.input.mouse.isLocked ? 'YES' : 'NO'}</div>
      <div style="margin-top: 5px; color: #0f8;">WASD - Move, Mouse - Look</div>
    `
  }
  
  requestAnimationFrame(updateHUD)
}
updateHUD()

// Очищаем ресурсы при закрытии вкладки
window.addEventListener('beforeunload', () => {
  game.stop()
})
