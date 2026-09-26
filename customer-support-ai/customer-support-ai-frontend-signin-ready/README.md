# RESOLVE IQ — Student 4 Frontend

Frontend implementation for the AI Customer Intelligence + Resolution Agent. The root route is a Dala-inspired, scroll-driven 3D particle story; the operational product remains under `/app/*`.

## What is included

- Scroll-driven 3D particle intro: brain → scattered signals → semantic clusters → insight bulb → investigation network → recommendation / approval → resolution.
- One persistent Three.js WebGL particle field with real x/y/z depth, perspective, slow object motion, ambient triangle particles, and smooth scroll-controlled morphing.
- Product storytelling text that appears with a restrained pop-in animation as each scene enters the viewport.
- Minimal intro header: brand + Enter Application. No scene-navigation bar.
- RESOLVE IQ complaint, case, analytics, approval, authentication and dashboard interfaces.
- Typed contracts, mock repository and service layer ready for backend integration.

## Run

```bash
npm install
npm run dev
```

## Build / type-check

```bash
npm run lint
npm run build
```

## Integration

Set `VITE_API_BASE_URL` in `.env` when connecting to the FastAPI backend. The UI uses `src/services/*` so mocked data can be replaced without coupling the views to backend details.

## Intro architecture

`src/components/intro/` contains only the landing experience:

- `IntroShell.tsx` — full-page story sections, active-scene reveal animation, and minimal header
- `ParticleField3D.tsx` — persistent Three.js WebGL particle renderer and scroll-driven morphing
- `particleTargets3D.ts` — deterministic 3D target generators and mask sampling for the brain and bulb
- `storyScenes.tsx` — product copy and scene layout metadata

The operational application is kept separate and is not dependent on the intro animation.
