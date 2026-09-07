TERMINUS POSE 80

FILES
  terminus-pose-80.html             shared wall / authoritative world
  terminus-pose-80-controller.html phone camera / pose controller

DEPLOY
  Put both files in the same GitHub Pages directory.
  Open terminus-pose-80.html on the large screen.
  The wall creates a PeerJS room and displays a QR code.
  Each player scans the QR. It opens the lightweight controller file with ?join=<wall-peer-id>.
  Each phone grants camera permission locally; video is not transmitted.

BODY GRAMMAR
  WINGS OUT + HOLD      claim / launch your plane
  LEAN LEFT / RIGHT     bank the current embodied object
  BOTH WINGS UP / DOWN  climb / dive (or float / descend while embodied as mail)
  RIGHT HAND TO CHEST   arm the letter
  EXTEND RIGHT ARM      release the letter from your aircraft
  AFTER RELEASE         your body controls that letter until it lands; your aircraft continues straight
  AFTER LANDING         embodiment returns to your aircraft automatically

NETWORK MODEL
  wall connection -> stable seat -> persistent plane -> personal mail
  ALFA / BRAVO / CORAL / DELTA / ECHO / FOX
  The wall owns simulation state. Phones send only pose-derived control intent at ~25 Hz.
  A disconnect releases its plane seat without renumbering the surviving players.

NOTES
  The first six aircraft slots are reserved for human players; remaining slots can still carry simulated traffic.
  Pose-controlled planes no longer expire on the old ten-second PLANE_LIFE timer.
  Personal letters are concurrent: several players can be steering separate mail at once.
  MediaPipe Pose Landmarker runs in the phone browser (GPU first, CPU fallback).
