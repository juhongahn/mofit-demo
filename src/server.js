import express from "express";
// import WebSocket from "ws";
import SocketIO from "socket.io";
import http from "http";

const PORT = process.env.PORT || 3000;

const app = express();

app.set("view engine", "pug");
app.set("views", process.cwd() + "/src/views");

app.use("/public", express.static(process.cwd() + "/src/public"));

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/*", (req, res) => {
  res.redirect("/");
});

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

let roomObjArr = [
  // {
  //   roomName,
  //   currentNum,
  //   users: [
  //     {
  //       socketId,
  //       nickname,
  //     },
  //   ],
  // },
];
const MAXIMUM = 5;

wsServer.on("connection", (socket) => {
  let myRoomName = null;
  let myNickname = null;
  let userCountArray = [];
  socket.on("join_room", (roomName, nickname) => {
    myRoomName = roomName;
    myNickname = nickname;
    var isHost = false
    let isRoomExist = false;
    let targetRoomObj = null;

    // forEach를 사용하지 않는 이유: callback함수를 사용하기 때문에 return이 효용없음.
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === roomName) {
        // Reject join the room
        if (roomObjArr[i].currentNum >= MAXIMUM) {
          socket.emit("reject_join");
          return;
        }

        isRoomExist = true;
        targetRoomObj = roomObjArr[i];
        break;
      }
    }

    // Create room
    if (!isRoomExist) {
      targetRoomObj = {
        roomName,
        currentNum: 0,
        users: [],
        scoreArrived: 0,
      };
      isHost = true;
      roomObjArr.push(targetRoomObj);
    }

    //Join the room
    targetRoomObj.users.push({
      socketId: socket.id,
      nickname,
      isReady: false,
      isHost: isHost,
      count: 0,
    });
    ++targetRoomObj.currentNum;

    socket.join(roomName);
    socket.emit("accept_join", targetRoomObj.users);
  });

  socket.on("ready", (roomName, nickname) => {
    var curRoom = null;
    var all_ready = true;
    let host, hostSocketId;
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === roomName) {
        curRoom = roomObjArr[i];
        break;
      }
    }
    curRoom.users.forEach((user) => {
      if (user.nickname === nickname) {
        user.isReady = true;
        console.log(`${user.nickname}: is ready`)
      }
      if (!user.isReady && !user.isHost) all_ready = false;
      if (user.isHost) {
        host = user;
        hostSocketId = user.socketId
      }
    })

    if (all_ready) {
      socket.to(hostSocketId).emit("all_ready");
    }
  });

  socket.on("un_ready", (roomName, nickname) => {
    var curRoom = null;
    var hostSocketId;
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === roomName) {
        curRoom = roomObjArr[i];
        break;
      }
    }
    curRoom.users.forEach((user) => {
      if (user.nickname === nickname) {
        user.isReady = false;
        console.log(`${user.nickname}: is unready`)
      }
    })

    curRoom.users.forEach((user) => {

      if (user.isHost) {
        hostSocketId = user.socketId
      }
    })
    socket.to(hostSocketId).emit("not_all_ready");
  });

  socket.on("game_start", (roomName) => {
    wsServer.emit("game_start");
  })

  socket.on("game_end", (roomName, nickname, count) => {

    var curRoom = null;
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === roomName) {
        curRoom = roomObjArr[i];
        break;
      }
    }

    curRoom.users.forEach((user) => {
      if (user.nickname === nickname) {
        user.count = count;
        curRoom.scoreArrived++;
      }
    })

    if (curRoom.scoreArrived == 2) {
      var scores = [];
      curRoom.users.forEach((user) => {
        console.log(`${user.socketId} : ${user.count}`)
        scores.push({ user_socket: user.socketId, score: user.count });
      })

      if (scores[0].score > scores[1].score) {
        wsServer.to(scores[0].user_socket).emit("winner");
        wsServer.to(scores[1].user_socket).emit("loser");

      } else if (scores[0].score < scores[1].score) {
        wsServer.to(scores[0].user_socket).emit("loser");
        wsServer.to(scores[1].user_socket).emit("winner");
      } else {
        wsServer.emit("draw");
      }
    }
  })

  socket.on("count_up", (count, roomName) => {
    socket.to(roomName).emit("count_up", count);
  })

  socket.on("offer", (offer, remoteSocketId, localNickname) => {
    socket.to(remoteSocketId).emit("offer", offer, socket.id, localNickname);
  });

  socket.on("answer", (answer, remoteSocketId) => {
    socket.to(remoteSocketId).emit("answer", answer, socket.id);
  });

  socket.on("ice", (ice, remoteSocketId) => {
    socket.to(remoteSocketId).emit("ice", ice, socket.id);
  });

  socket.on("chat", (message, roomName) => {
    socket.to(roomName).emit("chat", message);
  });

  socket.on("disconnecting", () => {
    socket.to(myRoomName).emit("leave_room", socket.id, myNickname);

    let isRoomEmpty = false;
    for (let i = 0; i < roomObjArr.length; ++i) {
      if (roomObjArr[i].roomName === myRoomName) {
        const newUsers = roomObjArr[i].users.filter(
          (user) => user.socketId != socket.id
        );
        roomObjArr[i].users = newUsers;
        --roomObjArr[i].currentNum;

        if (roomObjArr[i].currentNum == 0) {
          isRoomEmpty = true;
        }
      }
    }

    // Delete room
    if (isRoomEmpty) {
      const newRoomObjArr = roomObjArr.filter(
        (roomObj) => roomObj.currentNum != 0
      );
      roomObjArr = newRoomObjArr;
    }
  });
});

const handleListen = () =>
  console.log(`✅ Listening on http://localhost:${PORT}`);
httpServer.listen(PORT, handleListen);
