// 实验配置
const colors = ['red', 'green', 'blue', 'yellow'];
const colorNames = ['红色', '绿色', '蓝色', '黄色'];
const words = ['红', '绿', '蓝', '黄'];
const nGroups = 3;
const nTrialsPerGroup = 100;
const nTrainingTrials = 30;
const stimulusDuration = 800;
const minIntervalDuration = 800;
const maxIntervalDuration = 2000;
const consistentProbability = 0.5;
const audioFiles = ['/static/audio/audio1.mp3', '/static/audio/audio2.mp3', '/static/audio/audio3.mp3'];

// 实验状态变量
let currentGroup = 0;
let currentTrialInGroup = 0;
let results = [];
let trainingResults = [];
let stimulusTimeout;
let intervalTimeout;
let currentAudio;
let startTime;
let isExperimentRunning = false;
let isTrainingPhase = false;
let userId = null;
let correctCount = 0;
let incorrectCount = 0;
let totalReactionTime = 0;
let trialActive = false;
let isWaitingInterval = false;
let isExperimentComplete = false;

// DOM元素
const nums = document.querySelectorAll('.nums span');
const counter = document.querySelector('.counter');
const startButton = document.getElementById('start-button');
const startTrainingButton = document.getElementById('start-training-button');
const stimulus = document.getElementById('stimulus');
const responseButtons = document.getElementById('response-buttons');
const nextGroupButton = document.getElementById('next-group-button');
const progressBar = document.getElementById('progress-bar');
const resultsDiv = document.getElementById('results');
const errorMessage = document.getElementById('error-message');
const loginPrompt = document.getElementById('login-prompt');
const consistentBtn = document.getElementById('consistent-btn');
const inconsistentBtn = document.getElementById('inconsistent-btn');
const phaseIndicator = document.getElementById('phase-indicator');
const correctCountEl = document.getElementById('correct-count');
const incorrectCountEl = document.getElementById('incorrect-count');
const averageRtEl = document.getElementById('average-rt');
const trainingProgressEl = document.getElementById('training-progress');
const trainingModal = document.getElementById('training-modal');
const confirmTrainingButton = document.getElementById('confirm-training-button');
const groupReportModal = document.getElementById('group-report-modal');
const groupReportContent = document.getElementById('group-report-content');
const continueExperimentBtn = document.getElementById('continue-experiment-btn');

// 生成随机间隔时间
function getRandomInterval() {
    return Math.floor(Math.random() * (maxIntervalDuration - minIntervalDuration + 1)) + minIntervalDuration;
}

// 初始化函数
async function init() {
    // 绑定事件监听器
    startButton.addEventListener('click', showTrainingModal);
    consistentBtn.addEventListener('click', () => recordResponse('consistent'));
    inconsistentBtn.addEventListener('click', () => recordResponse('inconsistent'));
    confirmTrainingButton.addEventListener('click', startTraining);
    continueExperimentBtn.addEventListener('click', startNextGroup);

    await checkLoginStatus();
    startButton.disabled = false;
}

// 显示训练说明模态框
function showTrainingModal() {
    trainingModal.style.display = 'flex';
}

// 获取当前用户ID
async function getUserId() {
    try {
        const response = await fetch('/api/get-user-id', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('获取用户ID失败');
        const data = await response.json();
        return data.user_id;
    } catch (error) {
        console.error('获取用户ID失败:', error);
        return null;
    }
}

// 检查登录状态
async function checkLoginStatus() {
    try {
        userId = await getUserId();
        if (!userId) {
            loginPrompt.textContent = '请先登录再参与实验';
            loginPrompt.style.display = 'block';
            startButton.disabled = true;
            return false;
        }
        loginPrompt.textContent = `用户ID: ${userId}`;
        loginPrompt.style.display = 'block';
        return true;
    } catch (error) {
        console.error('登录检查失败:', error);
        return false;
    }
}

// 预加载音频
function preloadAudio() {
    return audioFiles.map(src => {
        const audio = new Audio(src);
        audio.preload = 'auto';
        return audio;
    });
}

const preloadedAudios = preloadAudio();

// 重置倒计时动画
function resetCountdown() {
    counter.style.display = 'block';
    stimulus.style.visibility = 'hidden';
    responseButtons.style.visibility = 'hidden';
    nums.forEach(num => num.className = '');
    nums[0].classList.add('in');
}

// 运行倒计时动画
function runCountdown() {
    nums.forEach((num, index) => {
        num.addEventListener('animationend', e => {
            if (e.animationName === 'goIn' && index !== nums.length - 1) {
                num.classList.remove('in');
                num.classList.add('out');
            } else if (e.animationName === 'goOut' && num.nextElementSibling) {
                num.nextElementSibling.classList.add('in');
            } else {
                counter.style.display = 'none';
                if (isTrainingPhase) {
                    startTrainingTrial();
                } else {
                    startExperimentTrial();
                }
            }
        });
    });
}

// 开始训练试验
function startTrainingTrial() {
    console.log(`[TRAINING] 开始训练试验 ${currentTrialInGroup + 1}/${nTrainingTrials}`);
    isExperimentRunning = true;
    stimulus.style.display = 'block';
    responseButtons.style.visibility = 'visible';
    phaseIndicator.textContent = `训练 ${currentTrialInGroup + 1}/${nTrainingTrials}`;
    updateTrainingProgress();
    showStimulus();
}

// 开始实验试验
function startExperimentTrial() {
    console.log(`[EXPERIMENT] 开始第 ${currentGroup + 1} 组实验，试验 ${currentTrialInGroup + 1}/${nTrialsPerGroup}`);
    isExperimentRunning = true;
    stimulus.style.display = 'block';
    responseButtons.style.visibility = 'visible';
    phaseIndicator.textContent = `实验组 ${currentGroup + 1}/${nGroups} - 试验 ${currentTrialInGroup + 1}/${nTrialsPerGroup}`;
    playAudio();
    showStimulus();
}

// 更新训练进度显示
function updateTrainingProgress() {
    trainingProgressEl.textContent = `训练进度: ${currentTrialInGroup + 1}/${nTrainingTrials}`;
    trainingProgressEl.style.display = 'block';
}

// 开始训练
function startTraining() {
    isTrainingPhase = true;
    trainingModal.style.display = 'none';
    startButton.style.display = 'none';
    startTrainingButton.style.display = 'none';
    currentTrialInGroup = 0;
    resetCountdown();
    runCountdown();
}

// 开始正式实验
function startExperiment() {
    isTrainingPhase = false;
    isExperimentComplete = false;
    startTrainingButton.style.display = 'none';
    document.querySelector('.stats-container').style.display = 'none';
    currentGroup = 0;
    currentTrialInGroup = 0;
    results = [];
    correctCount = 0;
    incorrectCount = 0;
    totalReactionTime = 0;
    resetCountdown();
    runCountdown();
}

// 播放音频
function playAudio() {
    if (isTrainingPhase) return;

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    currentAudio = preloadedAudios[currentGroup];
    currentAudio.loop = true;
    currentAudio.play().catch(e => console.error('音频播放失败:', e));
}

// 停止音频
function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
}

// 生成刺激
function generateStimulus() {
    const isConsistent = Math.random() < consistentProbability;
    let color, word, indexColor, indexWord;

    if (isConsistent) {
        const index = Math.floor(Math.random() * colors.length);
        color = colors[index];
        word = words[index];
    } else {
        do {
            indexColor = Math.floor(Math.random() * colors.length);
            indexWord = Math.floor(Math.random() * words.length);
        } while (indexColor === indexWord);
        color = colors[indexColor];
        word = words[indexWord];
    }

    return { color, word, isConsistent };
}

// 显示刺激
function showStimulus() {
    if (!isExperimentRunning || isWaitingInterval || isExperimentComplete) return;

    isWaitingInterval = true;
    clearTimeout(stimulusTimeout);
    clearTimeout(intervalTimeout);

    // 检查是否完成当前阶段
    if (isTrainingPhase && currentTrialInGroup >= nTrainingTrials) {
        endTraining();
        return;
    } else if (!isTrainingPhase && currentTrialInGroup >= nTrialsPerGroup) {
        endGroup();
        return;
    }

    // 生成刺激
    const { color, word, isConsistent } = generateStimulus();
    stimulus.textContent = word;
    stimulus.style.color = color;
    stimulus.style.visibility = 'visible';
    consistentBtn.disabled = false;
    inconsistentBtn.disabled = false;
    startTime = performance.now();

    // 存储当前刺激信息
    stimulus.dataset.color = color;
    stimulus.dataset.word = word;
    stimulus.dataset.isConsistent = isConsistent;

    // 激活试验
    trialActive = true;

    // 设置刺激显示计时器
    stimulusTimeout = setTimeout(() => {
        handleTrialEnd();
    }, stimulusDuration);

    updateProgressBar();
}

// 处理试验结束
function handleTrialEnd() {
    if (!isExperimentRunning || !trialActive || isExperimentComplete) return;
    trialActive = false;

    const trialData = {
        group: isTrainingPhase ? 0 : currentGroup + 1,
        trial: currentTrialInGroup + 1,
        word: stimulus.dataset.word,
        color: stimulus.dataset.color,
        isConsistent: stimulus.dataset.isConsistent === "true",
        response: '无响应',
        reactionTime: null,
        isCorrect: false,
        timestamp: Date.now(),
        isTraining: isTrainingPhase
    };

    if (isTrainingPhase) {
        trainingResults.push(trialData);
    } else {
        results.push(trialData);
        incorrectCount++;
    }
    stimulus.style.visibility = 'hidden';
    currentTrialInGroup++;

    updateStats();

    // 准备下一次试验
    isWaitingInterval = false;
    intervalTimeout = setTimeout(() => {
        if (isTrainingPhase && currentTrialInGroup < nTrainingTrials) {
            showStimulus();
        } else if (!isTrainingPhase && currentTrialInGroup < nTrialsPerGroup) {
            showStimulus();
        } else {
            if (isTrainingPhase) {
                endTraining();
            } else {
                endGroup();
            }
        }
    }, getRandomInterval());
}

function updateStats() {
    if (isTrainingPhase) return;

    const totalResponses = correctCount + incorrectCount;
    const averageRT = correctCount > 0 ? Math.round(totalReactionTime / correctCount) : 0;

    correctCountEl.textContent = correctCount;
    incorrectCountEl.textContent = incorrectCount;
    averageRtEl.textContent = averageRT;
}

function recordResponse(response) {
    if (!isExperimentRunning || !trialActive || isExperimentComplete) return;
    trialActive = false;
    clearTimeout(stimulusTimeout);

    const reactionTime = Math.round(performance.now() - startTime);
    const isConsistent = stimulus.dataset.isConsistent === "true";
    const isCorrect = (response === 'consistent') === isConsistent;

    const trialData = {
        group: isTrainingPhase ? 0 : currentGroup + 1,
        trial: currentTrialInGroup + 1,
        word: stimulus.dataset.word,
        color: stimulus.dataset.color,
        isConsistent: isConsistent,
        response: response === 'consistent' ? '一致' : '不一致',
        reactionTime: reactionTime,
        isCorrect: isCorrect,
        timestamp: Date.now(),
        isTraining: isTrainingPhase
    };

    if (isTrainingPhase) {
        trainingResults.push(trialData);
    } else {
        results.push(trialData);
        if (isCorrect) {
            correctCount++;
            totalReactionTime += reactionTime;
        } else {
            incorrectCount++;
        }
    }
    stimulus.style.visibility = 'hidden';
    currentTrialInGroup++;

    updateStats();

    // 准备下一次试验
    isWaitingInterval = false;
    intervalTimeout = setTimeout(() => {
        if (isTrainingPhase && currentTrialInGroup < nTrainingTrials) {
            showStimulus();
        } else if (!isTrainingPhase && currentTrialInGroup < nTrialsPerGroup) {
            showStimulus();
        } else {
            if (isTrainingPhase) {
                endTraining();
            } else {
                endGroup();
            }
        }
    }, getRandomInterval());
}

// 更新进度条
function updateProgressBar() {
    let progress;
    if (isTrainingPhase) {
        progress = (currentTrialInGroup / nTrainingTrials) * 100;
    } else {
        const totalTrials = nGroups * nTrialsPerGroup;
        const completedTrials = currentGroup * nTrialsPerGroup + currentTrialInGroup;
        progress = (completedTrials / totalTrials) * 100;
    }
    progressBar.style.width = `${progress}%`;
}

// 生成单个组的报告
function generateSingleGroupReport(groupNumber) {
    const groupResults = results.filter(result => result.group === groupNumber);
    const correctTrials = groupResults.filter(result => result.isCorrect);
    const incorrectTrials = groupResults.filter(result => !result.isCorrect);
    const noResponseTrials = groupResults.filter(result => result.response === '无响应');

    const consistentTrials = groupResults.filter(result => result.isConsistent);
    const inconsistentTrials = groupResults.filter(result => !result.isConsistent);

    const falseAlarms = inconsistentTrials.filter(trial => trial.response === '一致').length;
    const falseAlarmRate = inconsistentTrials.length > 0 ?
        Math.round((falseAlarms / inconsistentTrials.length) * 100) : 0;

    // 修复漏报率计算
    const misses = consistentTrials.filter(trial => trial.response === '无响应').length;
    const missRate = consistentTrials.length > 0 ?
        Math.round((misses / consistentTrials.length) * 100) : 0;

    const accuracy = groupResults.length > 0 ? Math.round((correctTrials.length / groupResults.length) * 100) : 0;
    const avgRT = correctTrials.length > 0 ? Math.round(correctTrials.reduce((sum, trial) => sum + trial.reactionTime, 0) / correctTrials.length) : 0;

    let reportHTML = `
        <div class="group-report">
            <h3>第 ${groupNumber} 组实验结果</h3>
            <table class="summary-table">
                <tr>
                    <th>指标</th>
                    <th>值</th>
                </tr>
                <tr>
                    <td>正确率</td>
                    <td>${accuracy}%</td>
                </tr>
                <tr>
                    <td>平均反应时</td>
                    <td>${avgRT}ms</td>
                </tr>
                <tr>
                    <td>虚报率</td>
                    <td>${falseAlarmRate}%</td>
                </tr>
                <tr>
                    <td>漏报率</td>
                    <td>${missRate}%</td>
                </tr>
            </table>
        </div>
    `;

    return reportHTML;
}

// 生成完整实验报告
function generateFullReport() {
    const totalTrials = results.length;
    const accuracy = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;
    const avgRT = correctCount > 0 ? Math.round(totalReactionTime / correctCount) : 0;

    let reportHTML = `
        <div class="full-report">
            <h2>实验完整报告</h2>
            <div class="overall-summary">
                <h3>整体表现</h3>
                <table class="summary-table">
                    <tr>
                        <th>指标</th>
                        <th>值</th>
                    </tr>
                    <tr>
                        <td>总正确率</td>
                        <td>${accuracy}%</td>
                    </tr>
                    <tr>
                        <td>总平均反应时</td>
                        <td>${avgRT}ms</td>
                    </tr>
                </table>
            </div>
    `;

    // 添加每个组的报告
    for (let i = 1; i <= nGroups; i++) {
        reportHTML += generateSingleGroupReport(i);
    }

    reportHTML += `</div>`;

    return reportHTML;
}

// 显示组完成提示
function showGroupCompletePrompt() {
    groupReportContent.innerHTML = `
        <p>第 ${currentGroup + 1} 组实验已完成</p>
        ${currentGroup < nGroups - 1 ? '<p>准备开始下一组实验</p>' : ''}
    `;
    groupReportModal.style.display = 'flex';
}

// 结束训练阶段
function endTraining() {
    console.log("[TRAINING] 训练阶段结束");
    document.querySelector('.stats-container').style.display = 'flex';
    correctCount = 0;
    incorrectCount = 0;
    totalReactionTime = 0;
    updateStats();
    isExperimentRunning = false;
    isTrainingPhase = false;
    stimulus.textContent = "训练完成";
    stimulus.style.color = 'black';
    stimulus.style.visibility = 'visible';
    responseButtons.style.visibility = 'hidden';
    trainingProgressEl.style.display = 'none';
    phaseIndicator.textContent = "准备实验";

    // 显示开始实验按钮
    startTrainingButton.textContent = "开始正式实验";
    startTrainingButton.style.display = 'inline';
    startTrainingButton.onclick = startExperiment;

    // 重置试验计数器
    currentTrialInGroup = 0;
    currentGroup = 0;
}

// 结束当前组
function endGroup() {
    console.log(`[EXPERIMENT] 第 ${currentGroup + 1} 组实验结束`);
    isExperimentRunning = false;
    stimulus.textContent = "本组实验结束";
    stimulus.style.color = 'black';
    stimulus.style.visibility = 'visible';
    responseButtons.style.visibility = 'hidden';
    stopAudio();

    if (currentGroup >= nGroups - 1) {
        // 如果是最后一组，直接显示完整报告
        endExperiment();
    } else {
        // 否则显示组完成提示
        currentGroup++;
        showGroupCompletePrompt();
    }
}

// 开始下一组实验
function startNextGroup() {
    if (isExperimentComplete) return;

    console.log(`[EXPERIMENT] 开始第 ${currentGroup + 1} 组实验`);
    groupReportModal.style.display = 'none';
    currentTrialInGroup = 0;
    resetCountdown();
    runCountdown();
}

// 显示错误信息
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// 显示成功信息
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.querySelector('.container').appendChild(successDiv);
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// 提交结果到后端
async function submitResultsToBackend() {
    try {
        if (!results || results.length === 0) {
            throw new Error('没有可提交的实验数据');
        }

        const expectedTrials = nGroups * nTrialsPerGroup;
        if (results.length !== expectedTrials) {
            throw new Error(`试验数量不正确，应为${expectedTrials}次，实际为${results.length}次`);
        }

        const formattedResults = results.map(result => {
            return {
                group: result.group,
                trial: result.trial,
                word: result.word,
                color: result.color,
                response: result.response || '无响应',
                reactionTime: result.reactionTime || null,
                isConsistent: Boolean(result.isConsistent),
                isCorrect: Boolean(result.isCorrect),
                timestamp: result.timestamp || Date.now()
            };
        });

        console.log('准备提交的数据:', formattedResults);

        const response = await fetch('/submit-results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formattedResults),
            credentials: 'include'
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || `服务器返回错误: ${response.status}`);
        }

        showSuccess('数据提交成功！');
        return true;
    } catch (error) {
        console.error('提交错误详情:', error);
        showError(`提交失败: ${error.message}`);
        return false;
    }
}

// 结束实验
async function endExperiment() {
    isExperimentComplete = true;
    console.log("[EXPERIMENT] 实验结束");

    groupReportModal.style.display = 'none';
    stimulus.textContent = "实验结束";
    stimulus.style.color = 'black';
    responseButtons.style.visibility = 'hidden';
    stopAudio();
    phaseIndicator.textContent = "实验完成";

    // 验证数据完整性
    if (results.length !== nGroups * nTrialsPerGroup) {
        console.error(`[ERROR] 数据不完整，应有${nGroups * nTrialsPerGroup}次试验，实际${results.length}次`);
        showError("实验数据不完整，请联系实验管理员");
        return;
    }

    const success = await submitResultsToBackend();

    // 显示完整报告
    resultsDiv.innerHTML = generateFullReport();
    resultsDiv.style.display = 'block';

    // 显示返回按钮
    const returnButton = document.createElement('button');
    returnButton.textContent = '返回导航页';
    returnButton.className = 'return-button';
    returnButton.addEventListener('click', () => {
        window.location.href = '/navigation';
    });
    document.querySelector('.container').appendChild(returnButton);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);