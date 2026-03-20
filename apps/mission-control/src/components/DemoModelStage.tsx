import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  ContactShadows,
  Center,
  Html,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import stageModelUrl from "../assets/openclaw-lobster.glb?url";

function Model({
  modelRef,
}: {
  modelRef: React.RefObject<THREE.Group | null>;
}) {
  const { scene } = useGLTF(stageModelUrl);
  const normalizedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.18 / maxAxis;
    cloned.scale.setScalar(scale);
    return cloned;
  }, [scene]);

  return (
    <group ref={modelRef} rotation={[0, Math.PI, 0]}>
      <Center position={[0, -0.05, 0]}>
        <primitive object={normalizedScene} />
      </Center>
    </group>
  );
}

function SceneLighting() {
  const isLightMode = document.documentElement.classList.contains("light-mode");

  return (
    <>
      <color attach="background" args={[isLightMode ? "#f4f6fb" : "#05070b"]} />
      <ambientLight intensity={isLightMode ? 1.25 : 1.0} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={isLightMode ? 2.4 : 2.0}
        color={isLightMode ? "#ffffff" : "#8bd0ff"}
        castShadow
      />
      <pointLight
        position={[-3, 2.8, 2.4]}
        intensity={isLightMode ? 0.95 : 0.8}
        color={isLightMode ? "#ffe9d2" : "#ffe7ca"}
      />
      <pointLight
        position={[0, 1.6, -2.5]}
        intensity={isLightMode ? 0.42 : 0.52}
        color={isLightMode ? "#b4d4ff" : "#6db7ff"}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
        <circleGeometry args={[3.1, 48]} />
        <meshStandardMaterial
          color={isLightMode ? "#e7ebf3" : "#0d1017"}
          metalness={0.42}
          roughness={0.22}
          emissive={isLightMode ? "#bcd6ff" : "#17304d"}
          emissiveIntensity={isLightMode ? 0.06 : 0.12}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.345, 0]}>
        <ringGeometry args={[2.05, 2.35, 64]} />
        <meshBasicMaterial
          color={isLightMode ? "#5c9dff" : "#5db7ff"}
          transparent
          opacity={isLightMode ? 0.16 : 0.22}
        />
      </mesh>
    </>
  );
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div
        className="rounded-full border px-3 py-1.5 text-[11px] font-medium"
        style={{
          backgroundColor: "rgba(12,12,16,0.76)",
          borderColor: "rgba(255,255,255,0.12)",
          color: "white",
        }}
      >
        Loading model {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

export function DemoModelStage() {
  const modelRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const isLightMode = document.documentElement.classList.contains("light-mode");

  return (
    <div className="absolute inset-0 z-[2]">
      <Canvas shadows dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0.35, 10.5]} fov={22} />
        <SceneLighting />

        <Suspense fallback={<Loader />}>
          <Bounds fit clip observe margin={3.2}>
            <Model modelRef={modelRef} />
          </Bounds>
        </Suspense>

        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.38}
          scale={8}
          blur={2.8}
          far={3.5}
          resolution={512}
          color="#4ca6ff"
        />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={false}
          enableDamping={false}
          target={[0, 0.05, 0]}
          minPolarAngle={Math.PI / 2.25}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-0.9}
          maxAzimuthAngle={0.9}
        />
      </Canvas>

      <div
        className="absolute left-6 bottom-6 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] pointer-events-none"
        style={{
          backgroundColor: isLightMode
            ? "rgba(255,255,255,0.72)"
            : "rgba(10,10,14,0.58)",
          borderColor: isLightMode
            ? "rgba(20,20,30,0.08)"
            : "rgba(255,255,255,0.12)",
          color: isLightMode
            ? "rgba(20,20,30,0.68)"
            : "rgba(255,255,255,0.72)",
        }}
      >
        Drag to rotate model
      </div>
    </div>
  );
}

useGLTF.preload(stageModelUrl);
