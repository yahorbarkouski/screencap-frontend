"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";

export function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    const getViewportSize = () => {
      const w = window.innerWidth;
      const h = Math.max(
        window.innerHeight,
        document.documentElement.clientHeight,
        screen.availHeight,
        screen.height
      );
      return { width: w, height: h };
    };
    
    let { width, height } = getViewportSize();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2e2e2e);
    scene.fog = new THREE.Fog(0x2e2e2e, 300, 900);

    const noiseVertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const noiseFragmentShader = `
      uniform float time;
      varying vec2 vUv;

      float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }

      float noise(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          float a = rand(i);
          float b = rand(i + vec2(1.0, 0.0));
          float c = rand(i + vec2(0.0, 1.0));
          float d = rand(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 pos = vUv * 8.0 + vec2(time * 0.1, time * 0.05);
        float n = noise(pos);
        float val = 0.12 + n * 0.10;
        gl_FragColor = vec4(val, val, val, 1.0);
      }
    `;

    const noiseMaterial = new THREE.ShaderMaterial({
      vertexShader: noiseVertexShader,
      fragmentShader: noiseFragmentShader,
      uniforms: {
        time: { value: 0 }
      },
      depthWrite: false,
      side: THREE.BackSide 
    });

    const noisePlane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), noiseMaterial);
    noisePlane.position.z = -800;
    scene.add(noisePlane);

    const camera = new THREE.PerspectiveCamera(70, width / height, 1, 2000);
    camera.position.z = 0;

    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 2, 0, 0);
    pointLight1.position.set(200, 200, 400);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 1, 0, 0);
    pointLight2.position.set(-200, -200, -400);
    scene.add(pointLight2);

    const particleCount = 180;
    const particles = new THREE.Group();
    scene.add(particles);

    const r = 1000;
    const rHalf = r / 2;

    const nodeGeometry = new THREE.IcosahedronGeometry(6, 0);
    const nodeMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      flatShading: true,
      emissive: 0x111111,
      specular: 0xffffff,
      shininess: 30,
    });

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(nodeGeometry, nodeMaterial);
      p.position.set(
        Math.random() * r - rHalf,
        Math.random() * r - rHalf,
        Math.random() * r - rHalf
      );
      p.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        )
      };
      particles.add(p);
    }

    const segments = particleCount * particleCount;
    const positions = new Float32Array(segments * 3);
    const colors = new Float32Array(segments * 3);
    
    const linesGeometry = new THREE.BufferGeometry();
    const linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.65,
    });
    
    const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
    particles.add(linesMesh);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    
    const effect = new AsciiEffect(renderer, 'f,XH*#', { invert: true, resolution: 0.45});
    effect.setSize(width, height);
    effect.domElement.style.color = '#999';
    effect.domElement.style.backgroundColor = 'black';
    effect.domElement.style.position = 'absolute';
    effect.domElement.style.top = '0';
    effect.domElement.style.left = '0';
    effect.domElement.style.width = '100%';
    effect.domElement.style.height = '100%';
    effect.domElement.style.minHeight = '100dvh';
    effect.domElement.style.overflow = 'hidden';

    const styleId = "ascii-effect-style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            .ascii-effect-container table {
                font-family: "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace !important;
                font-weight: 500 !important;
                line-height: 1.0 !important;
                letter-spacing: 0px !important;
                min-height: 100dvh !important;
            }
        `;
        document.head.appendChild(style);
    }
    effect.domElement.classList.add("ascii-effect-container");
    container.appendChild(effect.domElement);

    let animationId: number;
    const maxDistance = 150;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      noiseMaterial.uniforms.time.value = time;

      let vertexpos = 0;
      let colorpos = 0;
      let numConnected = 0;

      const particlesArray = particles.children.filter(
        (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.uuid !== linesMesh.uuid
      );

      for (const p of particlesArray) {
        const v = p.userData.velocity as THREE.Vector3;
        p.position.add(v);

        if (p.position.x < -rHalf || p.position.x > rHalf) v.x = -v.x;
        if (p.position.y < -rHalf || p.position.y > rHalf) v.y = -v.y;
        if (p.position.z < -rHalf || p.position.z > rHalf) v.z = -v.z;
      }

      for (let i = 0; i < particlesArray.length; i++) {
        for (let j = i + 1; j < particlesArray.length; j++) {
          const dx = particlesArray[i].position.x - particlesArray[j].position.x;
          const dy = particlesArray[i].position.y - particlesArray[j].position.y;
          const dz = particlesArray[i].position.z - particlesArray[j].position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            const alpha = 1.0 - dist / maxDistance;

            positions[vertexpos++] = particlesArray[i].position.x;
            positions[vertexpos++] = particlesArray[i].position.y;
            positions[vertexpos++] = particlesArray[i].position.z;

            positions[vertexpos++] = particlesArray[j].position.x;
            positions[vertexpos++] = particlesArray[j].position.y;
            positions[vertexpos++] = particlesArray[j].position.z;

            colors[colorpos++] = alpha;
            colors[colorpos++] = alpha;
            colors[colorpos++] = alpha;

            colors[colorpos++] = alpha;
            colors[colorpos++] = alpha;
            colors[colorpos++] = alpha;

            numConnected++;
          }
        }
      }

      linesGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
      );
      linesGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage)
      );
      linesGeometry.setDrawRange(0, numConnected * 2);
      linesGeometry.computeBoundingSphere();

      particles.rotation.y += delta * 0.03;

      effect.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const newSize = getViewportSize();
      width = newSize.width;
      height = newSize.height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      effect.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      container.removeChild(effect.domElement);
      renderer.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      noiseMaterial.dispose();
      linesGeometry.dispose();
      linesMaterial.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10"
      style={{ minHeight: "100dvh" }}
    />
  );
}
