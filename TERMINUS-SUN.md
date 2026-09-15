# Terminus × Sun Sphere

Open `terminus-one-81-pose.html?sun=1` locally, or the built Pages route `terminus-one-81-pose/?sun=1`.

1. Tap the Sun Sphere orb to start capture. The combined mode begins with the front camera.
2. The panorama becomes the sky surrounding the existing Terminus scene. Captured coverage and generated coverage are distinguished in the status line.
3. Press FLY to close the capture panel, then BODY. Stand fully in frame for the existing pose calibration and flight gestures.
4. SUN reopens the capture panel. STOP closes both capture and pose tracking and restores the original sky.

The existing globe, mail routes, phone controller, and body flight remain the Terminus world. This integration adds Sun Sphere's panorama as a surrounding sky; it does not replace Earth's geography with a navigable room mesh.

Sun Sphere owns camera and microphone access. Pose tracking clones its video tracks, so closing BODY does not stop the panorama. Closing SUN stops both. The panorama updates at most ten times per second. A hidden capture panel keeps its original renderer running.

The bridge is exposed only when Sun Sphere is framed with `?terminus=1`. The two pages must have the same origin. Without orientation sensing, the camera paints a fixed direction until manually aimed. Generated regions are not a measured room reconstruction. The existing simulated-room option can preview the sky without camera access; BODY requires a real camera.

Validation: both scripts pass Node syntax checks; a mocked integration test checked Pages URL resolution, texture attachment, update throttling, panel continuity, simulation labeling, stop/disposal, and reopening. Full browser, camera, microphone, and physical pose testing remains required. Chromium installation timed out in the execution environment, so no visual or device verification is claimed.
