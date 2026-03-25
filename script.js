// 音乐指挥家 - 主JavaScript文件

// 全局变量
let camera = null;
let cameraStream = null;
let frameRequestId = null;
let hands = null;
let audioContext = null;
let audioElement = null;
let audioSource = null;
let gainNode = null;
let playbackRate = 1.0;
let isPlaying = false;
let currentTrackIndex = 0;
let lastGesture = null;
let lastGestureTime = 0;
let gestureCooldown = 500; // 手势冷却时间（毫秒）
let volumeHistory = [];
let speedHistory = [];

// 音乐曲目列表（使用公开可访问的示例音频）
const tracks = [
    {
        title: "示例音乐 1",
        artist: "古典乐章",
        url: "https://assets.codepen.io/242518/test-music.mp3"
    },
    {
        title: "示例音乐 2",
        artist: "电子节奏",
        url: "https://assets.codepen.io/242518/test-music-2.mp3"
    },
    {
        title: "示例音乐 3",
        artist: "环境音乐",
        url: "https://assets.codepen.io/242518/test-music-3.mp3"
    }
];

// DOM元素引用
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startCameraBtn = document.getElementById('startCamera');
const stopCameraBtn = document.getElementById('stopCamera');
const cameraStatusText = document.getElementById('cameraStatusText');
const cameraStatusIndicator = document.getElementById('cameraStatusIndicator');
const handsCountElement = document.getElementById('handsCount');
const confidenceElement = document.getElementById('confidence');
const gestureIcon = document.getElementById('gestureIcon');
const gestureName = document.getElementById('gestureName');
const gestureDescription = document.getElementById('gestureDescription');
const playPauseBtn = document.getElementById('playPause');
const stopMusicBtn = document.getElementById('stopMusic');
const prevTrackBtn = document.getElementById('prevTrack');
const nextTrackBtn = document.getElementById('nextTrack');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const musicStatus = document.getElementById('musicStatus');
const timeDisplay = document.getElementById('timeDisplay');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');

// 初始化函数
function init() {
    // 设置事件监听器
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
    playPauseBtn.addEventListener('click', togglePlayPause);
    stopMusicBtn.addEventListener('click', stopMusic);
    prevTrackBtn.addEventListener('click', prevTrack);
    nextTrackBtn.addEventListener('click', nextTrack);
    volumeSlider.addEventListener('input', updateVolume);
    speedSlider.addEventListener('input', updateSpeed);
    
    // 初始化音频
    initAudio();
    
    // 初始化MediaPipe Hands
    initMediaPipe();
    
    // 更新UI
    updateTrackInfo();
    updateMusicStatus();
    
    console.log('音乐指挥家初始化完成');
}

// 初始化音频系统
function initAudio() {
    try {
        // 创建音频上下文
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 创建音频元素
        audioElement = new Audio();
        audioElement.crossOrigin = "anonymous";
        
        // 创建增益节点用于音量控制
        gainNode = audioContext.createGain();
        
        // 连接音频节点
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 设置初始音量
        gainNode.gain.value = volumeSlider.value / 100;
        
        // 音频事件监听器
        audioElement.addEventListener('loadedmetadata', () => {
            updateMusicStatus();
            updateTimeDisplay();
        });
        
        audioElement.addEventListener('timeupdate', updateTimeDisplay);
        audioElement.addEventListener('ended', nextTrack);
        audioElement.addEventListener('error', (e) => {
            console.error('音频加载错误:', e);
            musicStatus.textContent = '加载错误';
        });
        
        // 加载第一首曲目
        loadTrack(currentTrackIndex);
        
    } catch (error) {
        console.error('初始化音频系统失败:', error);
        musicStatus.textContent = '音频系统不可用';
        disableMusicControls();
    }
}

// 初始化MediaPipe Hands
function initMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    hands.onResults(onHandsResults);
}

// 启动摄像头
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false
        });
        
        videoElement.srcObject = stream;
        cameraStream = stream;
        
        // 等待视频元数据加载
        videoElement.onloadedmetadata = () => {
            console.log('视频尺寸:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        };
        
        // 开始发送帧到MediaPipe Hands
        function sendFrameToMediaPipe() {
            if (!cameraStream) return; // 如果摄像头已停止，退出循环
            
            // 确保视频已准备好
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                hands.send({ image: videoElement })
                    .catch(error => {
                        console.warn('发送帧到MediaPipe失败:', error);
                    });
            }
            
            // 继续下一帧
            frameRequestId = requestAnimationFrame(sendFrameToMediaPipe);
        }
        
        // 启动帧循环
        frameRequestId = requestAnimationFrame(sendFrameToMediaPipe);
        
        // 更新UI状态
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        cameraStatusText.textContent = '摄像头运行中';
        cameraStatusIndicator.classList.add('active');
        
        console.log('摄像头启动成功');
        
    } catch (error) {
        console.error('启动摄像头失败:', error);
        alert('无法访问摄像头。请确保已授予摄像头权限。\n错误详情: ' + error.message);
        cameraStatusText.textContent = '摄像头访问失败';
    }
}

// 停止摄像头
function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    
    // 清除画布
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 更新UI状态
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    cameraStatusText.textContent = '摄像头已停止';
    cameraStatusIndicator.classList.remove('active');
    
    // 重置手势显示
    updateGestureDisplay('等待手势...', '请启动摄像头并做出手势', 'fas fa-question-circle');
    handsCountElement.textContent = '0';
    confidenceElement.textContent = '0%';
    
    console.log('摄像头已停止');
}

// MediaPipe手部检测结果处理
function onHandsResults(results) {
    // 更新画布尺寸以匹配视频
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    // 清除画布
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 绘制视频帧
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height
    );
    
    // 如果有检测到手部
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // 更新手部计数和置信度
        handsCountElement.textContent = results.multiHandLandmarks.length.toString();
        if (results.multiHandedness && results.multiHandedness.length > 0) {
            const confidence = results.multiHandedness[0].score;
            confidenceElement.textContent = `${Math.round(confidence * 100)}%`;
        }
        
        // 绘制手部关键点和连接线
        drawHandLandmarks(results.multiHandLandmarks, results.multiHandedness);
        
        // 分析手势并控制音乐
        if (results.multiHandLandmarks.length === 1) {
            analyzeGesture(results.multiHandLandmarks[0]);
        }
    } else {
        // 没有检测到手部
        handsCountElement.textContent = '0';
        confidenceElement.textContent = '0%';
        updateGestureDisplay('未检测到手部', '请将手放在摄像头前', 'fas fa-hand-paper');
    }
    
    canvasCtx.restore();
}

// 绘制手部关键点和连接线
function drawHandLandmarks(landmarks, handedness) {
    // 绘制连接线
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#6c63ff';
    canvasCtx.fillStyle = '#6c63ff';
    
    // 手部连接线定义（MediaPipe Hands模型）
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // 拇指
        [0, 5], [5, 6], [6, 7], [7, 8], // 食指
        [0, 9], [9, 10], [10, 11], [11, 12], // 中指
        [0, 13], [13, 14], [14, 15], [15, 16], // 无名指
        [0, 17], [17, 18], [18, 19], [19, 20], // 小指
        [5, 9], [9, 13], [13, 17] // 手掌
    ];
    
    for (let i = 0; i < landmarks.length; i++) {
        const handLandmarks = landmarks[i];
        
        // 绘制连接线
        for (const [start, end] of connections) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(
                handLandmarks[start].x * canvasElement.width,
                handLandmarks[start].y * canvasElement.height
            );
            canvasCtx.lineTo(
                handLandmarks[end].x * canvasElement.width,
                handLandmarks[end].y * canvasElement.height
            );
            canvasCtx.stroke();
        }
        
        // 绘制关键点
        for (const landmark of handLandmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(
                landmark.x * canvasElement.width,
                landmark.y * canvasElement.height,
                4, 0, 2 * Math.PI
            );
            canvasCtx.fill();
        }
        
        // 显示左右手标签
        if (handedness && handedness[i]) {
            const label = handedness[i].label;
            const labelX = handLandmarks[0].x * canvasElement.width;
            const labelY = handLandmarks[0].y * canvasElement.height - 30;
            
            canvasCtx.fillStyle = label === 'Left' ? '#ff6b6b' : '#4ecdc4';
            canvasCtx.font = '16px Arial';
            canvasCtx.fillText(
                label === 'Left' ? '左手' : '右手',
                labelX, labelY
            );
        }
    }
}

// 分析手势并控制音乐
function analyzeGesture(landmarks) {
    const now = Date.now();
    
    // 手势冷却时间检查
    if (now - lastGestureTime < gestureCooldown) {
        return;
    }
    
    // 计算手势特征
    const isFist = isHandFist(landmarks);
    const isOpenPalm = isHandOpenPalm(landmarks);
    const isVictory = isVictorySign(landmarks);
    const indexFingerUp = isIndexFingerUp(landmarks);
    const handPosition = getHandPosition(landmarks);
    
    // 手势识别逻辑
    if (isOpenPalm) {
        // 张开手掌 - 播放/继续播放
        if (!isPlaying) {
            playMusic();
            updateGestureDisplay('播放', '张开手掌 - 音乐播放中', 'fas fa-play');
            lastGesture = 'play';
            lastGestureTime = now;
        }
    } else if (isFist) {
        // 握拳 - 暂停
        if (isPlaying) {
            pauseMusic();
            updateGestureDisplay('暂停', '握拳 - 音乐已暂停', 'fas fa-pause');
            lastGesture = 'pause';
            lastGestureTime = now;
        }
    } else if (isVictory) {
        // 胜利手势 - 下一曲
        nextTrack();
        updateGestureDisplay('下一曲', '胜利手势 - 切换到下一首曲目', 'fas fa-forward');
        lastGesture = 'next';
        lastGestureTime = now;
    } else if (indexFingerUp) {
        // 食指抬起 - 音量控制
        const indexFingerTip = landmarks[8];
        const middleFingerTip = landmarks[12];
        
        // 计算食指高度（相对于手掌）
        const wrist = landmarks[0];
        const indexFingerHeight = wrist.y - indexFingerTip.y;
        
        // 平滑音量变化
        volumeHistory.push(indexFingerHeight);
        if (volumeHistory.length > 5) volumeHistory.shift();
        
        const avgHeight = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
        
        // 映射到音量范围 (0-1)
        let newVolume = Math.min(Math.max(avgHeight * 5, 0), 1);
        
        // 更新音量
        updateVolumeFromGesture(newVolume);
        
        updateGestureDisplay('音量控制', '食指上下移动调节音量', 'fas fa-volume-up');
        lastGesture = 'volume';
    } else if (handPosition.movement !== 'none') {
        // 手部左右移动 - 播放速度控制
        const handX = handPosition.x;
        
        // 平滑速度变化
        speedHistory.push(handX);
        if (speedHistory.length > 5) speedHistory.shift();
        
        const avgX = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
        
        // 映射到速度范围 (0.5-2.0)
        let newSpeed = 0.5 + (avgX * 1.5);
        newSpeed = Math.min(Math.max(newSpeed, 0.5), 2.0);
        
        // 更新播放速度
        updateSpeedFromGesture(newSpeed);
        
        updateGestureDisplay('速度控制', '手左右移动调节播放速度', 'fas fa-tachometer-alt');
        lastGesture = 'speed';
    } else {
        // 未识别的手势
        updateGestureDisplay('手势识别中', '请做出控制手势', 'fas fa-hand-point-up');
    }
}

// 手势检测辅助函数
function isHandFist(landmarks) {
    // 握拳检测：所有指尖都靠近手掌
    const wrist = landmarks[0];
    const fingertips = [4, 8, 12, 16, 20]; // 拇指尖、食指尖、中指尖、无名指尖、小指尖
    
    let totalDistance = 0;
    for (const tipIndex of fingertips) {
        const tip = landmarks[tipIndex];
        const distance = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)
        );
        totalDistance += distance;
    }
    
    const avgDistance = totalDistance / fingertips.length;
    return avgDistance < 0.15; // 阈值
}

function isHandOpenPalm(landmarks) {
    // 张开手掌检测：所有指尖都远离手掌
    const wrist = landmarks[0];
    const fingertips = [4, 8, 12, 16, 20];
    
    let totalDistance = 0;
    for (const tipIndex of fingertips) {
        const tip = landmarks[tipIndex];
        const distance = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2)
        );
        totalDistance += distance;
    }
    
    const avgDistance = totalDistance / fingertips.length;
    return avgDistance > 0.25; // 阈值
}

function isVictorySign(landmarks) {
    // 胜利手势检测：食指和中指抬起，其他手指弯曲
    const indexFingerTip = landmarks[8];
    const indexFingerPip = landmarks[6];
    const middleFingerTip = landmarks[12];
    const middleFingerPip = landmarks[10];
    const ringFingerTip = landmarks[16];
    const ringFingerPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    
    // 食指和中指伸直
    const indexStraight = indexFingerTip.y < indexFingerPip.y;
    const middleStraight = middleFingerTip.y < middleFingerPip.y;
    
    // 无名指和小指弯曲
    const ringBent = ringFingerTip.y > ringFingerPip.y;
    const pinkyBent = pinkyTip.y > pinkyPip.y;
    
    // 拇指位置不太重要
    return indexStraight && middleStraight && ringBent && pinkyBent;
}

function isIndexFingerUp(landmarks) {
    // 食指抬起检测
    const indexFingerTip = landmarks[8];
    const indexFingerPip = landmarks[6];
    const middleFingerTip = landmarks[12];
    const middleFingerPip = landmarks[10];
    
    // 食指伸直且高于中指
    const indexStraight = indexFingerTip.y < indexFingerPip.y;
    const indexAboveMiddle = indexFingerTip.y < middleFingerTip.y;
    
    return indexStraight && indexAboveMiddle;
}

function getHandPosition(landmarks) {
    // 获取手部位置和移动方向
    const wrist = landmarks[0];
    
    // 简单的位置追踪
    return {
        x: wrist.x,
        y: wrist.y,
        movement: 'none' // 简化版本，实际应追踪历史位置
    };
}

// 音乐控制函数
function loadTrack(trackIndex) {
    if (trackIndex < 0 || trackIndex >= tracks.length) {
        console.error('无效的曲目索引:', trackIndex);
        return;
    }
    
    const track = tracks[trackIndex];
    currentTrackIndex = trackIndex;
    
    // 更新音频元素源
    audioElement.src = track.url;
    audioElement.load();
    
    // 更新UI
    updateTrackInfo();
    musicStatus.textContent = '加载中...';
    
    // 启用控制按钮
    enableMusicControls();
    
    console.log(`加载曲目: ${track.title}`);
}

function playMusic() {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    audioElement.play()
        .then(() => {
            isPlaying = true;
            updateMusicStatus();
            updatePlayPauseButton();
            console.log('音乐开始播放');
        })
        .catch(error => {
            console.error('播放失败:', error);
            musicStatus.textContent = '播放失败';
        });
}

function pauseMusic() {
    audioElement.pause();
    isPlaying = false;
    updateMusicStatus();
    updatePlayPauseButton();
    console.log('音乐已暂停');
}

function togglePlayPause() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function stopMusic() {
    audioElement.pause();
    audioElement.currentTime = 0;
    isPlaying = false;
    updateMusicStatus();
    updatePlayPauseButton();
    console.log('音乐已停止');
}

function prevTrack() {
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) {
        newIndex = tracks.length - 1; // 循环到最后
    }
    loadTrack(newIndex);
    
    // 如果之前正在播放，继续播放
    if (isPlaying) {
        setTimeout(() => playMusic(), 100);
    }
}

function nextTrack() {
    let newIndex = currentTrackIndex + 1;
    if (newIndex >= tracks.length) {
        newIndex = 0; // 循环到开头
    }
    loadTrack(newIndex);
    
    // 如果之前正在播放，继续播放
    if (isPlaying) {
        setTimeout(() => playMusic(), 100);
    }
}

function updateVolume() {
    const volume = volumeSlider.value / 100;
    if (gainNode) {
        gainNode.gain.value = volume;
    }
    volumeValue.textContent = `${volumeSlider.value}%`;
    console.log(`音量更新: ${volume}`);
}

function updateVolumeFromGesture(volume) {
    // 将手势检测的音量值映射到滑块范围
    const sliderValue = Math.round(volume * 100);
    volumeSlider.value = sliderValue;
    updateVolume();
}

function updateSpeed() {
    playbackRate = speedSlider.value / 100;
    if (audioElement) {
        audioElement.playbackRate = playbackRate;
    }
    speedValue.textContent = `${playbackRate.toFixed(1)}x`;
    console.log(`播放速度更新: ${playbackRate}`);
}

function updateSpeedFromGesture(speed) {
    // 将手势检测的速度值映射到滑块范围
    const sliderValue = Math.round(speed * 100);
    speedSlider.value = sliderValue;
    updateSpeed();
}

// UI更新函数
function updateTrackInfo() {
    const track = tracks[currentTrackIndex];
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
}

function updateMusicStatus() {
    if (!audioElement.src) {
        musicStatus.textContent = '未加载';
        return;
    }
    
    if (isPlaying) {
        musicStatus.textContent = '播放中';
    } else if (audioElement.currentTime > 0) {
        musicStatus.textContent = '已暂停';
    } else {
        musicStatus.textContent = '已停止';
    }
}

function updateTimeDisplay() {
    if (!audioElement.duration) return;
    
    const current = formatTime(audioElement.currentTime);
    const total = formatTime(audioElement.duration);
    timeDisplay.textContent = `${current} / ${total}`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayPauseButton() {
    const icon = playPauseBtn.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
        playPauseBtn.title = '暂停';
    } else {
        icon.className = 'fas fa-play';
        playPauseBtn.title = '播放';
    }
}

function updateGestureDisplay(name, description, iconClass) {
    gestureName.textContent = name;
    gestureDescription.textContent = description;
    
    const icon = gestureIcon.querySelector('i');
    icon.className = iconClass;
    
    // 添加动画效果
    gestureIcon.style.transform = 'scale(1.1)';
    setTimeout(() => {
        gestureIcon.style.transform = 'scale(1)';
    }, 200);
}

function enableMusicControls() {
    playPauseBtn.disabled = false;
    stopMusicBtn.disabled = false;
    prevTrackBtn.disabled = false;
    nextTrackBtn.disabled = false;
    volumeSlider.disabled = false;
    speedSlider.disabled = false;
}

function disableMusicControls() {
    playPauseBtn.disabled = true;
    stopMusicBtn.disabled = true;
    prevTrackBtn.disabled = true;
    nextTrackBtn.disabled = true;
    volumeSlider.disabled = true;
    speedSlider.disabled = true;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 导出全局函数（用于调试）
window.app = {
    playMusic,
    pauseMusic,
    stopMusic,
    nextTrack,
    prevTrack,
    startCamera,
    stopCamera,
    updateVolume,
    updateSpeed
};