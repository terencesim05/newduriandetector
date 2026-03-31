import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function WireframeGlobe() {
  const groupRef = useRef()

  useFrame((_state, delta) => {
    groupRef.current.rotation.y += delta * 0.15
  })

  const latLines = useMemo(() => {
    const lines = []
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * (Math.PI / 180)
      const r = Math.sin(phi) * 2
      const y = Math.cos(phi) * 2
      const points = []
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2
        points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
      }
      lines.push(points)
    }
    return lines
  }, [])

  const lonLines = useMemo(() => {
    const lines = []
    for (let lon = 0; lon < 360; lon += 30) {
      const theta = lon * (Math.PI / 180)
      const points = []
      for (let i = 0; i <= 64; i++) {
        const phi = (i / 64) * Math.PI
        points.push(
          new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * 2,
            Math.cos(phi) * 2,
            Math.sin(phi) * Math.sin(theta) * 2
          )
        )
      }
      lines.push(points)
    }
    return lines
  }, [])

  const nodes = useMemo(() => {
    const pts = []
    for (let i = 0; i < 60; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      pts.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * 2.01,
          Math.cos(phi) * 2.01,
          Math.sin(phi) * Math.sin(theta) * 2.01
        )
      )
    }
    return pts
  }, [])

  const connections = useMemo(() => {
    const conns = []
    for (let i = 0; i < 20; i++) {
      const a = nodes[Math.floor(Math.random() * nodes.length)]
      const b = nodes[Math.floor(Math.random() * nodes.length)]
      if (a !== b && a.distanceTo(b) < 2.5) {
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(2.3)
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
        conns.push(curve.getPoints(32))
      }
    }
    return conns
  }, [nodes])

  const lineProps = { color: '#3b82f6', transparent: true }

  return (
    <group ref={groupRef}>
      {/* Sphere shell */}
      <mesh>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#1e3a5f" transparent opacity={0.04} />
      </mesh>

      {/* Latitude lines */}
      {latLines.map((points, i) => (
        <line key={`lat-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial {...lineProps} opacity={0.12} />
        </line>
      ))}

      {/* Longitude lines */}
      {lonLines.map((points, i) => (
        <line key={`lon-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial {...lineProps} opacity={0.12} />
        </line>
      ))}

      {/* Network nodes */}
      {nodes.map((pos, i) => (
        <mesh key={`node-${i}`} position={pos}>
          <sphereGeometry args={[i % 5 === 0 ? 0.025 : 0.015, 8, 8]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={i % 5 === 0 ? 0.8 : 0.4} />
        </mesh>
      ))}

      {/* Arc connections */}
      {connections.map((points, i) => (
        <line key={`arc-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#60a5fa" transparent opacity={0.15} />
        </line>
      ))}

      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2.5, 0.3, 0]}>
        <torusGeometry args={[2.6, 0.003, 8, 128]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

export default function GlobeScene({ className = '' }) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <WireframeGlobe />
      </Canvas>
    </div>
  )
}
