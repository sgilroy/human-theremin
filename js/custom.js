import {Camera} from './camera.js';
import * as params from './params';

let camera;

const synth = new Tone.Synth().toDestination();

const video = document.getElementById('video');
const liveView = document.getElementById('liveView');
const demosSection = document.getElementById('demos');
// const enableWebcamButton = document.getElementById('webcamButton');
const jointSetIndicator = document.getElementById('jointSetIndicator');

//attach a click listener to a play button
video?.addEventListener('click', async () => {
	await Tone.start();
	console.log('audio is ready');

  //create a synth and connect it to the main output (your speakers)
  let synth;
  synth = new Tone.Synth().toDestination();
});

// Check if webcam access is supported.
function getUserMediaSupported() {
  return !!(navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia);
}

window.addEventListener('load', onLoad);

function onLoad() {
  // If webcam supported, add event listener to button for when user
  // wants to activate it to call enableCam function which we will 
  // define in the next step.
  if (getUserMediaSupported()) {
    console.warn('Enabling camera; getUserMedia() is supported by your browser');
    // enableWebcamButton.addEventListener('click', enableCam);
    enableCam();
  } else {
    console.warn('getUserMedia() is not supported by your browser');
  }
}

// Enable the live webcam view and start classification.
async function enableCam(event) {
  if (!detector) {
    return;
  }
  
  // Hide the button once clicked.
  // event.target.classList.add('removed');
  
  // getUsermedia parameters to force video but not audio.
  const constraints = {
    video: true
  };

  await initializeCamera();
  predictWebcam();
}

let videoRect;
async function handleVideoLoaded() {
  videoRect = video.getBoundingClientRect(); 
  predictWebcam();
}

async function initializeCamera() {
  camera = await Camera.setupCamera({targetFPS: 60, sizeOption: '640 X 480'});
}

function calculateDistance(p1, p2) {
  const a = p2.x - p1.x;
  const b = p2.y - p1.y;
  const c = p2.z - p1.z;

  return Math.hypot(a, b, c);
}

function calculateDistance2D(p1, p2) {
  const a = p2.x - p1.x;
  const b = p2.y - p1.y;

  return Math.hypot(a, b);
}

function calculateAngle(p1, p2, p3) {
  const d12 = calculateDistance(p1, p2);
  const d23 = calculateDistance(p2, p3);
  const d13 = calculateDistance(p1, p3);

  const angle = ((d12 ** 2) + (d23 ** 2) - (d13 ** 2)) / (2 * d12 * d23);
  return Math.acos(angle);
}

// class JointDefinition {
//   private aboveIndex;
  
//   JointDefinition(aboveIndex, onIndex, belowIndex) {

//   }
// };

const lerp = (x, y, a) => x * (1 - a) + y * a;

// const jointDefinitions = [new JointDefinition()];
async function predictWebcam() {
  let poses = await detector.estimatePoses(video);

  // console.log('predictWebcam', poses.length);
  for (let n = 0; n < poses.length; n++) {
    // Only proceed if we are over threshold for the pose
    if (poses[n].score > 0.33) {
      // For the meaning of the indexes in keypoints, see:
      // https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/README.md#blazepose-keypoints-used-in-mediapipe-blazepose
      const jointSets = {
        elbows: [
          [12, 14, 16], // right elboow
          [11, 13, 15], // left elbow
        ],
        hips: [
          [12, 24, 26], // right hip
          [11, 23, 25], // left hip
        ],
        shoulders: [
          [24, 12, 14], // right shoulder
          [23, 11, 13], // left shoulder
        ],
        knees: [
          [24, 26, 28], // right knee
          [23, 25, 27], // left knee
        ],
        wrists: [
          [14, 16, 20], // right wrist
          [13, 15, 19], // left wrist
        ],
      };

      // Use the anchor tag (text after the hash) to pick a joint set
      const jointSetName = window.location.hash && window.location.hash.slice(1);
      jointSetIndicator.innerHTML = jointSets[jointSetName] ? jointSetName : 'elbows (default)';
      const joints = jointSets[jointSetName] || jointSets['elbows'];
      
      const angles = [];
      for (const points of joints) {
        // const points = [12, 14, 16]; // right elboow
        const keypoints3D = [poses[n].keypoints3D[points[0]], poses[n].keypoints3D[points[1]], poses[n].keypoints3D[points[2]]];

        const pointScoreThreshold = 0.33;
        if (keypoints3D[0].score > pointScoreThreshold && keypoints3D[1].score > pointScoreThreshold && keypoints3D[2].score > pointScoreThreshold) {
          poses[n].keypoints[points[1]].isActiveJoint = true;
          const angle = calculateAngle(keypoints3D[0], keypoints3D[1], keypoints3D[2]);
          // console.log('angle', angle);

          // synth.triggerAttackRelease(lerp(200, 1500, angle / Math.PI), "8n");
          angles.push(angle);
        }
      }
      if (angles.length > 0) {
        const min = Math.min(...angles);
        console.log('angles', angles, min);
        synth.triggerAttackRelease(lerp(200, 1500, min / Math.PI), "8n");
      }
    }
  }

  camera.drawCtx();

  if (poses && poses.length > 0) {
    camera.drawResults(poses);
  }

  // Call this function again to keep predicting when the browser is ready.
  window.requestAnimationFrame(predictWebcam);  
}

let detector;
(async () => {
  // detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet);
  const model = poseDetection.SupportedModels.BlazePose;
  params.STATE.model = model;
  const detectorConfig = {
    // runtime: 'mediapipe', // or 'tfjs'
    runtime: 'tfjs',
    modelType: 'full'
  };
  detector = await poseDetection.createDetector(model, detectorConfig);
  console.log('pose detection detector created');
  demosSection.classList.remove('invisible');
  onLoad();
})();
