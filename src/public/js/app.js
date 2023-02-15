// 변경!
// const video = document.createElement("video");
// 전역변수 전환

// 소켓 연결
const socket = io();

const timeCounter = document.querySelector("#timerBox");
const myFace = document.querySelector("#myFace");
const readyBtn = document.querySelector("#readyBtn");
const muteBtn = document.querySelector("#mute");
const muteIcon = muteBtn.querySelector(".muteIcon");
const unMuteIcon = muteBtn.querySelector(".unMuteIcon");
const cameraBtn = document.querySelector("#camera");
const cameraIcon = cameraBtn.querySelector(".cameraIcon");
const unCameraIcon = cameraBtn.querySelector(".unCameraIcon");
const camerasSelect = document.querySelector("#cameras");
const call = document.querySelector("#call");
const welcome = document.querySelector("#welcome");
const countText = document.querySelector("pushCount");
const HIDDEN_CN = "hidden";

let model, webcam, ctx, labelContainer, maxPredictions;

// const video = document.createElement("video");
let animationId;
let myStream;
let muted = true;
unMuteIcon.classList.add(HIDDEN_CN);
let cameraOff = false;
unCameraIcon.classList.add(HIDDEN_CN);
let roomName = "";
let nickname = "";
let peopleInRoom = 1;
let allReady = false;
let timeCount = document.querySelector("time");
let pushupCount = 0;
let isPause = false;

let pcObj = {
  // remoteSocketId: pc
};
let isGameTimerStop = false;
function startTimer() {
  var time = 20; //기준시간 작성

  if (time == 0) {
    clearInterval(x); //setInterval() 실행을 끝냄
    handleGameEnd();
    isGameTimerStop = true;
  }
  if (!isGameTimerStop && time > 0) {
    const timerBox = document.getElementById("timerBox");
    const timer = timerBox.querySelector("p");
    var x = setInterval(function () {
      min = parseInt(time / 60); //몫을 계산
      sec = time % 60; //나머지를 계산
      time--;
      timer.innerHTML = `${sec}`;
    }, 1000);
  }
}

function handleGameEnd() {
  socket.emit("game_end", roomName, nickname, count);
  var audio = new Audio('/public/my_model/gameend.mp3');
  audio.play();
  window.cancelAnimationFrame(animationId);
}

async function poseDetect() {
  const URL = "/public/my_model/";
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";

  // 모델 초기화
  model = await tmPose.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();
  animationId = window.requestAnimationFrame(loop);
}

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks();
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;

      if (currentCamera.label == camera.label) {
        option.selected = true;
      }

      camerasSelect.appendChild(option);
    });
  } catch (error) {
    console.log(error);
  }
}



async function getMedia(deviceId) {

  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );

    // stream을 mute하는 것이 아니라 HTML video element를 mute한다.
    myFace.srcObject = myStream;  // 스트림을 꽂는 순간 video 태그에 연결들어옴.
    myFace.muted = true;

    if (!deviceId) {
      // mute default
      myStream //
        .getAudioTracks()
        .forEach((track) => (track.enabled = false));

      await getCameras();
    }
  } catch (error) {
    console.log(error);
  }
}

async function loop(timestamp) {
  //webcam.update(); // update the webcam frame
  await predict();
  window.requestAnimationFrame(loop);
}

function handleReadyClick(event) {

  if (readyBtn.innerText == "준비" && readyBtn.style.color == "white") {
    alert("준비");
    readyBtn.style.color = "gray";
    socket.emit("ready", roomName, nickname);

  } else if (readyBtn.innerText == "준비" && readyBtn.style.color == "gray") {
    alert("준비 해제");
    readyBtn.style.color = "white";
    socket.emit("un_ready", roomName, nickname);
  } else if (readyBtn.innerText == "시작" && !readyBtn.disabled) {
    // 게임 스타트.
    socket.emit("game_start", roomName);
  }
};

socket.on("game_start", () => {
  readyBtn.hidden = true;
  setGameTimer();
})

function startGame() {
  var gameStartAudio = new Audio(`/public/my_model/gamestart.mp3`);
  gameStartAudio.play();
  startTimer();
  poseDetect();
  handleGameStart();
}
let isStop = false;

function setGameTimer() {

  var timer = 3;
  let x = setInterval(() => {
    if (timer == 0) {
      clearInterval(x);
      isStop = true;
      startGame();
    } else if (timer > 0 && !isStop) {
      var audio = new Audio(`/public/my_model/${timer}.mp3`);
      audio.play();
      console.log(timer);
      timer--;
    }
  }, 1000);
}
function handleGameStart() {
  const userContainers = document.getElementsByClassName('people2');

  const hostCounterBox = document.createElement("h3");
  hostCounterBox.innerText = 0;
  hostCounterBox.setAttribute("class", "counter");
  userContainers[0].appendChild(hostCounterBox);

  const guestCounterBox = document.createElement("h3");
  guestCounterBox.innerText = 0;
  guestCounterBox.setAttribute("class", "counter");
  userContainers[1].appendChild(guestCounterBox);
}

function handleCount(count) {
  const userContainers = document.getElementsByClassName('counter');
  console.log(count)
  userContainers[0].innerText = count;
  socket.emit("count_up", count, roomName);
}

socket.on("count_up", (count) => {
  console.log(count)
  const userContainers = document.getElementsByClassName('counter');
  userContainers[1].innerText = count;
})

function handleMuteClick() {
  myStream //
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (muted) {
    unMuteIcon.classList.remove(HIDDEN_CN);
    muteIcon.classList.add(HIDDEN_CN);
    muted = false;
  } else {
    muteIcon.classList.remove(HIDDEN_CN);
    unMuteIcon.classList.add(HIDDEN_CN);
    muted = true;
  }
}

function handleCameraClick() {
  myStream //
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraIcon.classList.remove(HIDDEN_CN);
    unCameraIcon.classList.add(HIDDEN_CN);
    cameraOff = false;
  } else {
    unCameraIcon.classList.remove(HIDDEN_CN);
    cameraIcon.classList.add(HIDDEN_CN);
    cameraOff = true;
  }
}

async function handleCameraChange() {
  try {
    await getMedia(camerasSelect.value);
    if (peerConnectionObjArr.length > 0) {
      const newVideoTrack = myStream.getVideoTracks()[0];
      peerConnectionObjArr.forEach((peerConnectionObj) => {
        const peerConnection = peerConnectionObj.connection;
        const peerVideoSender = peerConnection
          .getSenders()
          .find((sender) => sender.track.kind == "video");
        peerVideoSender.replaceTrack(newVideoTrack);
      });
    }
  } catch (error) {
    console.log(error);
  }
}

readyBtn.addEventListener("click", handleReadyClick);
muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

/////////////////////////////////// prototype
// Screen Sharing

let captureStream = null;

async function startCapture() {
  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const screenVideo = document.querySelector("#screen");
    screenVideo.srcObject = captureStream;
  } catch (error) {
    console.error(error);
  }
}

// Welcome Form (choose room)

call.classList.add(HIDDEN_CN);
// welcome.hidden = true;

const welcomeForm = welcome.querySelector("form");



async function initCall() {
  welcome.hidden = true;
  call.classList.remove(HIDDEN_CN);
  await getMedia();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();

  if (socket.disconnected) {
    socket.connect();
  }

  const welcomeRoomName = welcomeForm.querySelector("#roomName");
  const welcomeNickname = welcomeForm.querySelector("#nickname");
  const nicknameContainer = document.querySelector("#userNickname");
  roomName = welcomeRoomName.value;
  welcomeRoomName.value = "";
  nickname = welcomeNickname.value;
  welcomeNickname.value = "";
  nicknameContainer.innerText = nickname;


  // 서버에 join_room 이벤트로 roomName, nickname
  socket.emit("join_room", roomName, nickname);
  readyBtn.innerHTML = "시작";
  readyBtn.disabled = true;
  readyBtn.style.color = "gray";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Chat Form

const chatForm = document.querySelector("#chatForm");
const chatBox = document.querySelector("#chatBox");

const MYCHAT_CN = "myChat";
const NOTICE_CN = "noticeChat";

chatForm.addEventListener("submit", handleChatSubmit);

function handleChatSubmit(event) {
  event.preventDefault();
  const chatInput = chatForm.querySelector("input");
  const message = chatInput.value;
  chatInput.value = "";
  socket.emit("chat", `${nickname}: ${message}`, roomName);
  writeChat(`You: ${message}`, MYCHAT_CN);
}

function writeChat(message, className = null) {
  const li = document.createElement("li");
  const span = document.createElement("span");
  span.innerText = message;
  li.appendChild(span);
  li.classList.add(className);
  chatBox.prepend(li);
}

// Leave Room

const leaveBtn = document.querySelector("#leave");

function leaveRoom() {
  socket.disconnect();

  call.classList.add(HIDDEN_CN);
  welcome.hidden = false;

  peerConnectionObjArr = [];
  peopleInRoom = 1;
  nickname = "";

  myStream.getTracks().forEach((track) => track.stop());
  const nicknameContainer = document.querySelector("#userNickname");
  nicknameContainer.innerText = "";

  myFace.srcObject = null;
  clearAllVideos();
  clearAllChat();
}

function removeVideo(leavedSocketId) {
  const streams = document.querySelector("#streams");
  const streamArr = streams.querySelectorAll("div");
  streamArr.forEach((streamElement) => {
    if (streamElement.id === leavedSocketId) {
      streams.removeChild(streamElement);
    }
  });
}

function clearAllVideos() {
  const streams = document.querySelector("#streams");
  const streamArr = streams.querySelectorAll("div");
  streamArr.forEach((streamElement) => {
    if (streamElement.id != "myStream") {
      streams.removeChild(streamElement);
    }
  });
}

function clearAllChat() {
  const chatArr = chatBox.querySelectorAll("li");
  chatArr.forEach((chat) => chatBox.removeChild(chat));
}

leaveBtn.addEventListener("click", leaveRoom);

// Modal code

const modal = document.querySelector(".modal");
const modalText = modal.querySelector(".modal__text");
const modalBtn = modal.querySelector(".modal__btn");

function paintModal(text) {
  modalText.innerText = text;
  modal.classList.remove(HIDDEN_CN);

  modal.addEventListener("click", removeModal);
  modalBtn.addEventListener("click", removeModal);
  document.addEventListener("keydown", handleKeydown);
}

function removeModal() {
  modal.classList.add(HIDDEN_CN);
  modalText.innerText = "";
}

function handleKeydown(event) {
  if (event.code === "Escape" || event.code === "Enter") {
    removeModal();
  }
}

// Socket code

socket.on("reject_join", () => {
  // Paint modal
  paintModal("Sorry, The room is already full.");

  // Erase names
  const nicknameContainer = document.querySelector("#userNickname");
  nicknameContainer.innerText = "";
  roomName = "";
  nickname = "";
});

// 방 입장. 
socket.on("accept_join", async (userObjArr) => {
  await initCall();
  const length = userObjArr.length;
  if (length === 1) {
    return;
  }
  writeChat("공지!", NOTICE_CN);
  for (let i = 0; i < length - 1; ++i) {
    try {
      const newPC = createConnection(
        userObjArr[i].socketId,
        userObjArr[i].nickname
      );
      const offer = await newPC.createOffer();
      await newPC.setLocalDescription(offer);
      socket.emit("offer", offer, userObjArr[i].socketId, nickname);
      writeChat(`__${userObjArr[i].nickname}__`, NOTICE_CN);
    } catch (err) {
      console.error(err);
    }
  }
  writeChat("님이 방에 계십니다.", NOTICE_CN);
});

socket.on("all_ready", () => {
  alert("모두 준비완료")
  ableReadyButton();
  readyBtn.disabled = false;

})

socket.on("not_all_ready", () => {
  alert("모두 준비완료")
  unableReadyButton();
  readyBtn.disabled = true;
})

socket.on("offer", async (offer, remoteSocketId, remoteNickname) => {
  try {
    const newPC = createConnection(remoteSocketId, remoteNickname);
    await newPC.setRemoteDescription(offer);
    const answer = await newPC.createAnswer();
    await newPC.setLocalDescription(answer);
    socket.emit("answer", answer, remoteSocketId);
    writeChat(`공지! __${remoteNickname}__ 님이 방에 입장하셨습니다.`, NOTICE_CN);
  } catch (err) {
    console.error(err);
  }
});

socket.on("answer", async (answer, remoteSocketId) => {
  await pcObj[remoteSocketId].setRemoteDescription(answer);
  readyBtn.innerHTML = "준비";
  readyBtn.style.color = "white"
  readyBtn.disabled = false;
  readyBtn.setAttribute("class", "ableBtn");
});

socket.on("ice", async (ice, remoteSocketId) => {
  await pcObj[remoteSocketId].addIceCandidate(ice);
});

socket.on("chat", (message) => {
  writeChat(message);
});

socket.on("leave_room", (leavedSocketId, nickname) => {
  removeVideo(leavedSocketId);
  writeChat(`notice! ${nickname} leaved the room.`, NOTICE_CN);
  --peopleInRoom;
  sortStreams();
});

socket.on("winner", () => {
  var audio = new Audio('/public/my_model/winner.mp3');
  console.log("winner")
  audio.play();
})

socket.on("loser", () => {
  var audio = new Audio('/public/my_model/loser.mp3');
  console.log("loser")
  audio.play();
})

socket.on("draw", () => {
  var audio = new Audio('/public/my_model/draw.mp3');
  audio.play();
})

// RTC code

function createConnection(remoteSocketId, remoteNickname) {
  const myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", (event) => {
    handleIce(event, remoteSocketId);
  });
  myPeerConnection.addEventListener("addstream", (event) => {
    handleAddStream(event, remoteSocketId, remoteNickname);
  });
  // myPeerConnection.addEventListener(
  //   "iceconnectionstatechange",
  //   handleConnectionStateChange
  // );
  myStream //
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));

  pcObj[remoteSocketId] = myPeerConnection;

  ++peopleInRoom;
  sortStreams();
  return myPeerConnection;
}

function handleIce(event, remoteSocketId) {
  if (event.candidate) {
    socket.emit("ice", event.candidate, remoteSocketId);
  }
}

function handleAddStream(event, remoteSocketId, remoteNickname) {
  const peerStream = event.stream;
  paintPeerFace(peerStream, remoteSocketId, remoteNickname);
}

function paintPeerFace(peerStream, id, remoteNickname) {
  const streams = document.querySelector("#streams");
  const div = document.createElement("div");
  div.id = id;
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.width = "300";
  video.height = "800";
  video.srcObject = peerStream;
  const nicknameContainer = document.createElement("h3");
  nicknameContainer.id = "userNickname";
  nicknameContainer.innerText = remoteNickname;

  div.appendChild(video);
  div.appendChild(nicknameContainer);
  streams.appendChild(div);
  sortStreams();
}

function sortStreams() {
  const streams = document.querySelector("#streams");
  const streamArr = streams.querySelectorAll("div");
  streamArr.forEach((stream) => (stream.className = `people${peopleInRoom}`));
}

// var status = "Stand";
// var count = 0;

// async function loop(timestamp) {
//   webcam.update(); // update the webcam frame
//   await predict();
//   window.requestAnimationFrame(loop);
// }

let count = 0;
let curStatus = "Stand";
let bst = "Bent";
let bbst = "Squat";

async function predict() {
  // Prediction #1: run input through posenet
  // estimatePose can take in an image, video or canvas html element
  const { pose, posenetOutput } = await model.estimatePose(myFace);
  // Prediction 2: run input through teachable machine classification model
  const prediction = await model.predict(posenetOutput);
  if (prediction[0].probability.toFixed(2) >= 0.85) {
    if (curStatus == "Squat") {
      count++;
      var audio = new Audio('/public/my_model/' + count % 10 + '.mp3');
      handleCount(count);
      audio.play();
    }
    curStatus = "Stand";
  } else if (prediction[1].probability.toFixed(2) >= 0.9) {
    curStatus = "Squat";
  }

  // for (let i = 0; i < maxPredictions; i++) {
  //   const classPrediction =
  //     prediction[i].className + ": " + prediction[i].probability.toFixed(2);
  //   labelContainer.childNodes[i].innerHTML = classPrediction;
  // }

  // finally draw the poses
  // drawPose(pose);
  // console.log(count);
}

function ableReadyButton() {
  readyBtn.style.color = "white";
  readyBtn.classList.add('ableBtn');
}

function unableReadyButton() {
  readyBtn.style.color = "gray";
  readyBtn.classList.remove("ableBtn");
}

/*
function handleConnectionStateChange(event) {
  console.log(`${ pcObjArr.length - 1 } CS: ${ event.target.connectionState }`);
  console.log(`${ pcObjArr.length - 1 } ICS: ${ event.target.iceConnectionState }`);

  if (event.target.iceConnectionState === "disconnected") {
  }
}
*/

