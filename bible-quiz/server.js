const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- 遊戲狀態變數 ---
let isBuzzerOpen = false; 
let answeringTeam = null;  

// 🛑 新增：紀錄目前已經登入的小隊
// 格式會像這樣： { 'socketId123': '直升機', 'socketId456': '飛碟' }
let connectedTeams = {}; 

io.on('connection', (socket) => {
    console.log('有裝置連線了:', socket.id);

    // 1. 處理玩家登入請求 (防重複登入機制)
    socket.on('player-login', (teamName, callback) => {
        // 檢查所有已連線的名單中，是否已經包含這個隊伍名稱
        const isTaken = Object.values(connectedTeams).includes(teamName);
        
        if (isTaken) {
            // 被佔用了，回傳失敗訊息給手機
            callback({ success: false, message: `【${teamName}】已經有人登入囉！\n請確認是否選錯小隊，或請另一支手機退出。` });
            console.log(`阻擋重複登入：${teamName}`);
        } else {
            // 沒被佔用，登記該連線 ID 對應的小隊
            connectedTeams[socket.id] = teamName;
            callback({ success: true }); // 回傳成功訊息給手機
            console.log(`✅ ${teamName} 登入成功！目前連線隊伍：`, Object.values(connectedTeams));
        }
    });

    // 2. 處理玩家斷線 (網頁關閉、斷網等)
    socket.on('disconnect', () => {
        if (connectedTeams[socket.id]) {
            const droppedTeam = connectedTeams[socket.id];
            console.log(`⚠️ ${droppedTeam} 斷線了，釋放該隊名額。`);
            // 從已佔用名單中刪除，讓他們可以重新登入
            delete connectedTeams[socket.id];
        }
    });

    // --- 以下為原本的搶答核心邏輯 ---
    socket.on('host-open-buzzer', () => {
        isBuzzerOpen = true;  
        answeringTeam = null; 
        io.emit('buzzer-opened'); 
    });

    socket.on('player-buzz', (teamName) => {
        if (isBuzzerOpen) {
            isBuzzerOpen = false; 
            answeringTeam = teamName; 
            io.emit('team-buzzed', teamName); 
        }
    });

    socket.on('host-reset-buzzer', () => {
        isBuzzerOpen = false;
        answeringTeam = null;
        io.emit('buzzer-reset'); 
    });

    socket.on('player-submit-answer', (data) => {
        io.emit('answer-received', data); 
    });
});

// 讓伺服器自動抓取雲端主機分配的 Port，如果沒有就預設用 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器已啟動！Port: ${PORT}`);
});