class CPTTest {
    // 私有属性
    _config;
    _state;
    _audios = {};
    _elements = {};
    _storageKey = 'cptTestData';
    _serverOnline = true;
    _abortController = new AbortController();
    _stimulusCanvas; // 新增: 使用canvas来渲染刺激
    _canvasContext; // 新增: canvas的上下文

    constructor() {
        this._initializeConfig();
        this._initializeState();
        this._setupCanvas(); // 新增: 设置canvas
        this._setupAudio();
        this._setupEventListeners();
        this._setupUI();
        this.debug = false;
    }

    _initializeConfig() {
        this._config = {
            groups: 3,
            trialsPerGroup: 100,
            practiceTrials: 30,
            target: "9",
            distractors: ["0", "8", "6", "O", "Q", "G", "S", "♂"],
            trialDuration: 600,
            stimulusHideDelay: 0,
            responseWindowExtra: 0,
            minInterval: 800,
            maxInterval: 2000,
            targetProbability: 0.3,
            positionJitter: 80,
            strictMode: true,
            // 新增: 刺激物的样式配置
            stimulusStyle: {
                fontSize: 60,
                fontFamily: 'Arial, sans-serif',
                fillStyle: '#FFFFFF',
                shadowColor: 'rgba(0,0,0,0.2)',
                shadowBlur: 0,
                shadowOffsetX: 2,
                shadowOffsetY: 2
            },
            endpoints: {
                submit: '/submit-attention-results',
                userId: '/api/get-user-id'
            },
            audioFiles: [
                '/static/audio/audio1.mp3',
                '/static/audio/audio2.mp3',
                '/static/audio/audio3.mp3'
            ],
            offlineMode: {
                enabled: true,
                maxLocalStorageItems: 100,
                retryInterval: 5000,
                maxRetries: 3
            }
        };
    }

    _initializeState() {
        this._state = this._getInitialState();
    }

    _getInitialState() {
        return {
            running: false,
            currentGroup: 0,
            trialData: [],
            startTime: null,
            currentTrialResolve: null,
            stimulusShownTime: null,
            pendingSubmissions: 0,
            submissionErrors: 0,
            userId: null,
            stats: {
                hits: 0,
                misses: 0,
                falseAlarms: 0,
                correctRejections: 0,
                reactionTimes: []
            },
            offlineMode: false,
            retryCount: 0,
            currentStimulus: {
                text: null,
                position: null,
                isShowing: false,
                renderTimestamp: null
            },
            currentTrialData: null,
            containerSize: null
        };
    }

    _setupCanvas() {
        this._stimulusCanvas = document.createElement('canvas');
        this._stimulusCanvas.className = 'stimulus-canvas';
        this._stimulusCanvas.style.position = 'absolute';
        this._stimulusCanvas.style.left = '0';
        this._stimulusCanvas.style.top = '0';
        this._stimulusCanvas.style.width = '100%';
        this._stimulusCanvas.style.height = '100%';
        this._stimulusCanvas.style.pointerEvents = 'none';
        this._canvasContext = this._stimulusCanvas.getContext('2d');
    }

    _resizeCanvas() {
        if (!this._stimulusCanvas || !this._elements.stimulusContainer) return;

        const container = this._elements.stimulusContainer;
        const rect = container.getBoundingClientRect();

        this._stimulusCanvas.width = rect.width;
        this._stimulusCanvas.height = rect.height;

        this._state.containerSize = {
            width: rect.width,
            height: rect.height
        };

        if (this.debug) {
            console.log('Canvas resized:', rect.width, 'x', rect.height);
        }
    }

    _setupAudio() {
        this._config.audioFiles.forEach((src, index) => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.loop = true;
            audio.addEventListener('error', (e) => {
                console.warn(`音频加载失败: ${src}`, e);
            });
            this._audios[index + 1] = audio;
        });
    }

    _setupEventListeners() {
        this._elements = {
            responseButton: document.getElementById('responseButton'),
            startButton: document.getElementById('startButton'),
            stimulusContainer: document.getElementById('stimulus-container'),
            feedback: document.getElementById('feedback'),
            results: document.getElementById('results'),
            progressBar: document.getElementById('progress-bar'),
            modal: document.getElementById('instructionModal'),
            modalContent: document.querySelector('#instructionModal .modal-content'),
            confirmInstructionButton: document.getElementById('confirm-instruction-button'),
            closeModal: document.querySelector('.close-modal'),
            hitCount: document.getElementById('hit-count'),
            missCount: document.getElementById('miss-count'),
            falseAlarmCount: document.getElementById('false-alarm-count'),
            averageRT: document.getElementById('average-rt'),
            phaseIndicator: document.getElementById('phase-indicator')
        };

        if (this._elements.stimulusContainer) {
            this._elements.stimulusContainer.appendChild(this._stimulusCanvas);
            this._resizeCanvas();
        }

        this._elements.responseButton.addEventListener('click', this.handleResponse.bind(this));
        this._elements.startButton.addEventListener('click', this.start.bind(this));
        this._elements.confirmInstructionButton.addEventListener('click', this._startPractice.bind(this));
        this._elements.closeModal.addEventListener('click', () => this._elements.modal.classList.remove('active'));

        document.addEventListener('keydown', this._handleKeyPress.bind(this));
        window.addEventListener('online', this._handleNetworkChange.bind(this));
        window.addEventListener('offline', this._handleNetworkChange.bind(this));
        window.addEventListener('resize', this._handleResize.bind(this));
    }

    _handleResize() {
        this._resizeCanvas();
        if (this._state.currentStimulus.isShowing) {
            this._renderStimulus(
                this._state.currentStimulus.text,
                this._state.currentStimulus.position
            );
        }
    }

    _setupUI() {
        this._updateUIForNetworkStatus();
        this._updateStatsUI();
    }

    _handleNetworkChange() {
        if (navigator.onLine && this._state.offlineMode) {
            this._trySubmitPendingData().then(() => {});
        }
        this._updateUIForNetworkStatus();
    }

    _updateUIForNetworkStatus() {
        const isOnline = navigator.onLine;
        let statusElement = document.getElementById('network-status');

        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'network-status';
            statusElement.style.position = 'fixed';
            statusElement.style.bottom = '10px';
            statusElement.style.right = '10px';
            statusElement.style.padding = '5px 10px';
            statusElement.style.borderRadius = '4px';
            statusElement.style.fontSize = '0.8em';
            statusElement.style.zIndex = '1000';
            document.body.appendChild(statusElement);
        }

        statusElement.textContent = isOnline ? '在线' : '离线';
        statusElement.style.backgroundColor = isOnline ? '#00b894' : '#d63031';
        statusElement.style.color = 'white';
    }

    async start() {
        if (this._state.running) return;

        this._hideStimulus();
        this._elements.feedback.style.opacity = '0';
        this._state = this._getInitialState();
        this._state.running = true;
        this._elements.startButton.disabled = true;

        try {
            this._updateUIForNetworkStatus();
            this._resizeCanvas();

            try {
                await this._getUserId();
                this._serverOnline = true;
            } catch (error) {
                console.warn('无法获取用户ID，启用离线模式:', error.message);
                this._serverOnline = false;
                this._state.offlineMode = true;

                await this._showModal(`
                    <h3 style="color: var(--warning-color)">离线模式</h3>
                    <p>无法连接服务器，实验数据将保存在本地。</p>
                    <p>网络恢复后会自动同步。</p>
                    <button class="modal-confirm-btn">继续</button>
                `);
            }

            this._elements.modalContent.innerHTML = `
                <h2>持续性操作测试(CPT)</h2>
                <div id="instructions">
                    <p>在这个测试中，您将看到一系列字母和数字快速闪现。</p>
                    <ul>
                        <li>当您看到数字 <strong>"9"</strong> 时，请尽可能快地点击按钮</li>
                        <li>对其他所有刺激不做反应</li>
                        <li>请集中注意力，测试将持续几分钟</li>
                    </ul>
                    <p>首先将进行简短的练习，然后是正式测试。</p>
                </div>
                <button class="modal-confirm-btn">开始练习</button>
            `;

            await new Promise((resolve) => {
                this._elements.modal.classList.add('active');
                const confirmBtn = this._elements.modalContent.querySelector('.modal-confirm-btn');
                confirmBtn.addEventListener('click', () => {
                    this._elements.modal.classList.remove('active');
                    resolve();
                });
            });

            await this._runPractice();
            this._state.startTime = performance.now();

            // 运行所有实验组
            for (let group = 1; group <= this._config.groups; group++) {
                this._elements.phaseIndicator.textContent = `第 ${group} 组`;
                this._state.currentGroup = group;
                this._playAudio(group);
                await this._runGroup(group);
                this._stopAudio(group);
            }

            // 所有组完成后显示综合报告
            await this._showFinalReport();

        } catch (error) {
            console.error('测试错误:', error);
            this._showError(error.message || '测试过程中发生未知错误');
        } finally {
            this._state.running = false;
            this._elements.startButton.disabled = false;
            this._stopAllAudio();
            this._abortController.abort();
            this._abortController = new AbortController();
        }
    }

    async _showFinalReport() {
        const groupStats = [];
        for (let group = 1; group <= this._config.groups; group++) {
            groupStats.push(this._calculateGroupStats(group));
        }

        const overallStats = {
    accuracy: Math.round(groupStats.reduce((sum, stats) => sum + stats.accuracy, 0) / this._config.groups),
    hitRate: Math.round(groupStats.reduce((sum, stats) => sum + stats.hitRate, 0) / this._config.groups),
    averageRT: Math.round(groupStats.reduce((sum, stats) => sum + stats.averageRT, 0) / this._config.groups),
    dPrime: this._calculateDPrime()
};

        let reportHTML = `
            <div class="stats-card">
                <h3>测试完成</h3>
                <p><strong>总体正确率:</strong> ${overallStats.accuracy}%</p>
                <p><strong>总体目标检测率:</strong> ${overallStats.hitRate}%</p>
                <p><strong>总体平均反应时间:</strong> ${overallStats.averageRT}ms</p>
                <p><strong>注意力敏感度(d'):</strong> ${overallStats.dPrime.toFixed(2)}</p>
                <hr>
                <h4>各组表现详情</h4>
        `;

        groupStats.forEach((stats, index) => {
            reportHTML += `
                <div class="group-stats">
                    <h5>第 ${index + 1} 组</h5>
                    <p>正确率: ${stats.accuracy}% | 检测率: ${stats.hitRate}% | 反应时间: ${stats.averageRT}ms</p>
                </div>
            `;
        });

        reportHTML += `
                <button id="endTest" class="continue-btn">结束测试</button>
            </div>
        `;

        this._elements.results.innerHTML = reportHTML;
        document.getElementById('endTest').addEventListener('click', () => {
            window.location.href = '/navigation';
        });
    }

    async _startPractice() {
        this._elements.modal.classList.remove('active');
        await this._runPractice();
    }

    async _getUserId() {
        if (this._state.userId) return this._state.userId;

        try {
            const response = await fetch('/api/get-user-id', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('获取用户ID失败');

            const data = await response.json();
            if (!data.user_id) throw new Error('无效的用户ID');

            this._state.userId = data.user_id;
            return this._state.userId;
        } catch (error) {
            console.error('获取用户ID失败:', error);
            this._state.offlineMode = true;
            return null;
        }
    }

    async _trySubmitPendingData() {
        const pendingData = this._getLocalStorageData();
        if (!pendingData || pendingData.length === 0) return;

        try {
            const submissionData = pendingData.trialData.map(trial => ({
                group: trial.group,
                stimulus: trial.stimulus,
                isTarget: trial.isTarget,
                response: trial.result === 'hit' || trial.result === 'false_alarm',
                rt: trial.reactionTime || 0,
                score: this._calculateTrialScore(trial),
                timestamp: trial.timestamp || pendingData.completeTimestamp
            }));

            const response = await fetch('/submit-attention-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: JSON.stringify(submissionData),
                signal: this._abortController.signal
            });

            if (response.ok) {
                localStorage.removeItem(this._storageKey);
                console.log('离线数据同步成功');
                this._state.offlineMode = false;
            } else {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
        } catch (error) {
            console.warn('离线数据同步失败:', error);
        }
    }

    _getLocalStorageData() {
        try {
            const data = localStorage.getItem(this._storageKey);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('读取本地存储失败:', e);
            return null;
        }
    }

    _saveToLocalStorage() {
        if (!this._config.offlineMode.enabled) return;

        try {
            const existingData = this._getLocalStorageData() || { trialData: [] };

            const newData = {
                trialData: [
                    ...existingData.trialData,
                    ...this._state.trialData
                        .filter(trial => !trial.isPractice)
                        .map(trial => ({
                            group: trial.group,
                            stimulus: trial.stimulus,
                            isTarget: trial.isTarget,
                            response: trial.result === 'hit' || trial.result === 'false_alarm',
                            rt: trial.reactionTime || 0,
                            score: this._calculateTrialScore(trial),
                            timestamp: trial.timestamp || Date.now(),
                            userId: this._state.userId
                        }))
                ],
                stats: this._state.stats,
                totalTime: performance.now() - this._state.startTime,
                completeTimestamp: Date.now(),
                userId: this._state.userId
            };

            localStorage.setItem(this._storageKey, JSON.stringify(newData));
            console.log('数据已保存到本地存储');
        } catch (e) {
            console.error('保存到本地存储失败:', e);
        }
    }

    async _submitAllData() {
        if (this._state.trialData.length === 0) return;

        try {
            const submissionData = {
                user_id: this._state.userId,
                trials: this._state.trialData
                    .filter(trial => !trial.isPractice)
                    .map(trial => ({
                        group: trial.group,
                        stimulus: trial.stimulus,
                        isTarget: trial.isTarget,
                        response: trial.result === 'hit' || trial.result === 'false_alarm',
                        rt: trial.reactionTime || 0,
                        score: this._calculateTrialScore(trial),
                        timestamp: trial.timestamp || Date.now()
                    })),
                summary: {
                    hits: this._state.stats.hits,
                    misses: this._state.stats.misses,
                    falseAlarms: this._state.stats.falseAlarms,
                    correctRejections: this._state.stats.correctRejections,
                    averageRT: this._calculateRT(),
                    dPrime: this._calculateDPrime()
                }
            };

            if (this.debug) {
                console.log('准备提交的数据:', JSON.stringify(submissionData, null, 2));
            }

            const response = await fetch('/submit-attention-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: JSON.stringify(submissionData),
                signal: this._abortController.signal
            });

            if (!response.ok) {
                let errorMessage = `服务器响应错误: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    console.warn('解析错误响应失败:', e);
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || '提交失败');
            }

            return result;
        } catch (error) {
            console.error('提交错误:', error);

            if (this._state.retryCount < this._config.offlineMode.maxRetries) {
                this._state.retryCount++;
                const delay = this._config.offlineMode.retryInterval * Math.pow(2, this._state.retryCount - 1);

                console.log(`提交失败，尝试重试 (${this._state.retryCount}/${this._config.offlineMode.maxRetries})，等待 ${delay}ms`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return this._submitAllData();
            } else {
                this._state.offlineMode = true;
                this._saveToLocalStorage();
                throw error;
            }
        }
    }

    _calculateTrialScore(trial) {
        if (trial.isTarget && trial.result === 'hit') return 1;
        if (!trial.isTarget && trial.result === 'correct_rejection') return 1;
        return 0;
    }

    async _showModal(content) {
    this._stopAllAudio(); // ⬅️ 添加这一行：弹窗显示时立即停止音频

    return new Promise((resolve) => {
        this._elements.modalContent.innerHTML = content;
        this._elements.modal.classList.add('active');

        const confirmBtn = this._elements.modalContent.querySelector('.modal-confirm-btn');
        if (confirmBtn) {
            const handler = () => {
                this._elements.modal.classList.remove('active');
                confirmBtn.removeEventListener('click', handler);
                resolve();
            };
            confirmBtn.addEventListener('click', handler);
        }
    });
}

    async _runPractice() {
        await this._showModal(`
            <h2>练习阶段</h2>
            <p>现在开始练习，熟悉测试流程。</p>
            <p>请记住：只在看到数字 "9" 时点击按钮。</p>
            <button class="modal-confirm-btn">开始练习</button>
        `);

        this._elements.responseButton.disabled = false;
        this._updateProgressBar(0);

        for (let i = 0; i < this._config.practiceTrials; i++) {
            await this._runSingleTrial(true);
            this._updateProgressBar((i + 1) / this._config.practiceTrials * 100);
        }

        await this._showModal(`
            <h2>练习结束</h2>
            <p>您已完成练习，准备开始正式测试。</p>
            <button class="modal-confirm-btn">开始正式测试</button>
        `);
    }

    async _runGroup(group) {
    this._elements.responseButton.disabled = false;
    this._updateProgressBar(0);

    for (let i = 0; i < this._config.trialsPerGroup; i++) {
        await this._runSingleTrial(false);
        this._updateProgressBar(((i + 1) / this._config.trialsPerGroup) * 100);
    }

    // 添加：完成一组后提示用户点击继续
    if (group < this._config.groups) {
        await this._showModal(`
            <h2>第 ${group} 组完成</h2>
            <p>请准备进入下一组实验。</p>
            <button class="modal-confirm-btn">下一组实验</button>
        `);
    }
}


    async _runSingleTrial(isPractice) {
        return new Promise(async (resolve) => {
            const isTarget = Math.random() < this._config.targetProbability;
            const stimulus = isTarget
                ? this._config.target
                : this._config.distractors[Math.floor(Math.random() * this._config.distractors.length)];

            const interval = this._getRandomInterval();
            const position = this._getRandomPosition();

            if (this._state.currentStimulus.isShowing) {
                const remainingTime = this._config.trialDuration - (performance.now() - this._state.currentStimulus.renderTimestamp);
                if (remainingTime > 0) {
                    await new Promise(r => setTimeout(r, remainingTime));
                }
            }

            await new Promise(r => setTimeout(r, interval));

            const renderTime = this._showStimulus(stimulus, position);

            const trialData = {
                group: this._state.currentGroup,
                trialNumber: this._state.trialData.length + 1,
                isPractice,
                isTarget,
                stimulus,
                position,
                timestamp: Date.now(),
                startTime: performance.now(),
                renderTime
            };

            trialData.hideTimeoutId = setTimeout(() => {
                this._hideStimulus();
            }, this._config.trialDuration);

            trialData.responseTimeoutId = setTimeout(() => {
                if (this._state.currentTrialData === trialData) {
                    this._processTrialResult(trialData, null, false);
                }
            }, this._config.trialDuration + this._config.responseWindowExtra);

            this._state.currentTrialData = trialData;
            this._state.currentTrialResolve = resolve;
        });
    }

    _processTrialResult(trialData, responseTime, isResponse) {
        if (!trialData || this._state.currentTrialData !== trialData) return;

        clearTimeout(trialData.hideTimeoutId);
        clearTimeout(trialData.responseTimeoutId);

        if (responseTime) {
            trialData.responseTime = responseTime - trialData.startTime;
            trialData.reactionTime = responseTime - this._state.stimulusShownTime;
        }

        if (trialData.isTarget) {
            trialData.result = isResponse ? 'hit' : 'miss';
        } else {
            trialData.result = isResponse ? 'false_alarm' : 'correct_rejection';
        }

        if (!trialData.isPractice) {
            if (trialData.result === 'hit') {
                this._state.stats.hits++;
                this._state.stats.reactionTimes.push(trialData.reactionTime);
                this._showFeedback('✓', 'green');
            } else if (trialData.result === 'miss') {
                this._state.stats.misses++;
                this._showFeedback('✗', 'red');
            } else if (trialData.result === 'false_alarm') {
                this._state.stats.falseAlarms++;
                this._showFeedback('✗', 'red');
            }
        }

        trialData.timestamp = Date.now();
        this._state.trialData.push(trialData);
        this._updateStatsUI();
        this._state.currentTrialData = null;
        if (this._state.currentTrialResolve) this._state.currentTrialResolve();
    }

    _updateStatsUI() {
        this._elements.hitCount.textContent = this._state.stats.hits;
        this._elements.missCount.textContent = this._state.stats.misses;
        this._elements.falseAlarmCount.textContent = this._state.stats.falseAlarms;

        this._elements.averageRT.textContent = this._state.stats.reactionTimes.length > 0 ?
            Math.round(this._state.stats.reactionTimes.reduce((a, b) => a + b, 0) / this._state.stats.reactionTimes.length) :
            0;
    }

    _renderStimulus(stimulus, position) {
        if (!this._canvasContext || !this._stimulusCanvas) return;

        this._canvasContext.clearRect(0, 0, this._stimulusCanvas.width, this._stimulusCanvas.height);

        const style = this._config.stimulusStyle;
        this._canvasContext.font = `${style.fontSize}px ${style.fontFamily}`;
        this._canvasContext.fillStyle = style.fillStyle;
        this._canvasContext.textAlign = 'center';
        this._canvasContext.textBaseline = 'middle';

        if (style.shadowBlur > 0) {
            this._canvasContext.shadowColor = style.shadowColor;
            this._canvasContext.shadowBlur = style.shadowBlur;
            this._canvasContext.shadowOffsetX = style.shadowOffsetX;
            this._canvasContext.shadowOffsetY = style.shadowOffsetY;
        }

        this._canvasContext.fillText(stimulus, position.x, position.y);

        this._canvasContext.shadowBlur = 0;
        this._canvasContext.shadowOffsetX = 0;
        this._canvasContext.shadowOffsetY = 0;

        const renderTime = performance.now();

        this._state.currentStimulus = {
            text: stimulus,
            position,
            isShowing: true,
            renderTimestamp: renderTime
        };

        if (this.debug) {
            console.log('Stimulus rendered:', stimulus, 'at', position, 'time:', renderTime);
        }

        return renderTime;
    }

    _showStimulus(stimulus, position) {
        const renderTime = this._renderStimulus(stimulus, position);
        this._state.stimulusShownTime = renderTime || performance.now();

        if (this.debug) {
            console.log('Stimulus shown time:', this._state.stimulusShownTime);
        }
    }

    _hideStimulus() {
        if (!this._canvasContext || !this._stimulusCanvas) return;

        this._canvasContext.clearRect(0, 0, this._stimulusCanvas.width, this._stimulusCanvas.height);
        this._state.currentStimulus.isShowing = false;

        if (this.debug) {
            console.log('Stimulus hidden at:', performance.now());
        }
    }

    _showFeedback(symbol, color) {
        const feedback = this._elements.feedback;

        if (feedback.timeoutId) {
            clearTimeout(feedback.timeoutId);
        }

        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            color: ${color};
            opacity: 1;
            z-index: 1000;
            transition: opacity 0.5s;
        `;
        feedback.textContent = symbol;

        feedback.timeoutId = setTimeout(() => {
            feedback.style.opacity = 0;
        }, 800);
    }

    _showError(message) {
        this._elements.results.innerHTML = `
            <div class="stats-card" style="border-color: var(--error-color);">
                <h3 style="color: var(--error-color)">发生错误</h3>
                <p>${message}</p>
                <button id="retryButton" class="continue-btn">重试</button>
            </div>
        `;
        document.getElementById('retryButton').addEventListener('click', this.start.bind(this));
    }

    _handleKeyPress(e) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            this.handleResponse();
        }
    }

    handleResponse() {
        if (!this._state.currentTrialData || !this._state.stimulusShownTime) return;

        const responseTime = performance.now();
        this._processTrialResult(this._state.currentTrialData, responseTime, true);
    }

    _playAudio(group) {
        const audio = this._audios[group];
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn('音频播放失败:', e));
        }
    }

    _stopAudio(group) {
        const audio = this._audios[group];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }

    _stopAllAudio() {
        Object.values(this._audios).forEach(audio => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
    }

    _getRandomInterval() {
        return Math.floor(Math.random() * (this._config.maxInterval - this._config.minInterval + 1)) + this._config.minInterval;
    }

    _getRandomPosition() {
        if (!this._state.containerSize) {
            const rect = this._elements.stimulusContainer.getBoundingClientRect();
            this._state.containerSize = {
                width: rect.width,
                height: rect.height
            };
        }

        const centerX = this._state.containerSize.width / 2;
        const centerY = this._state.containerSize.height / 2;
        const jitter = this._config.positionJitter;

        return {
            x: centerX + (Math.random() * 2 - 1) * jitter,
            y: centerY + (Math.random() * 2 - 1) * jitter
        };
    }

    _updateProgressBar(percent) {
        this._elements.progressBar.style.width = `${percent}%`;
    }

    _calculateGroupStats(group) {
        const groupTrials = this._state.trialData.filter(trial => trial.group === group && !trial.isPractice);

        const hits = groupTrials.filter(trial => trial.result === 'hit').length;
        const misses = groupTrials.filter(trial => trial.result === 'miss').length;
        const falseAlarms = groupTrials.filter(trial => trial.result === 'false_alarm').length;
        const correctRejections = groupTrials.filter(trial => trial.result === 'correct_rejection').length;

        const totalTargets = hits + misses;
        const totalTrials = groupTrials.length;

        const accuracy = Math.round((hits + correctRejections) / totalTrials * 100);
        const hitRate = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 0;

        const reactionTimes = groupTrials
            .filter(trial => trial.result === 'hit' && trial.reactionTime)
            .map(trial => trial.reactionTime);

        const averageRT = reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
            : 0;

        return {
            accuracy,
            hitRate,
            averageRT,
            hits,
            misses,
            falseAlarms,
            correctRejections
        };
    }

    _getPerformanceInterpretation(stats) {
        const { accuracy, d_prime, falseAlarmRate } = stats;

        if (accuracy >= 90 && d_prime >= 2.5) {
            return '您的注意力表现非常优秀，能够稳定准确地识别目标。';
        } else if (accuracy >= 75 && d_prime >= 1.5) {
            return '您的注意力表现良好，但仍有提升空间，注意保持专注。';
        } else if (accuracy >= 60) {
            return '注意力表现一般，建议在安静环境下再次尝试测试。';
        } else {
            return '您的注意力表现较差，可能未能集中注意力或操作失误较多。';
        }
    }

    _calculateAccuracy() {
        const totalTrials = this._state.trialData.filter(trial => !trial.isPractice).length;
        if (totalTrials === 0) return 0;

        const correctResponses = this._state.stats.hits + this._state.stats.correctRejections;
        return Math.round((correctResponses / totalTrials) * 100);
    }

    _calculateHitRate() {
        const totalTargets = this._state.stats.hits + this._state.stats.misses;
        if (totalTargets === 0) return 0;

        return Math.round((this._state.stats.hits / totalTargets) * 100);
    }

    _calculateFalseAlarmRate() {
        const totalNonTargets = this._state.stats.falseAlarms + this._state.stats.correctRejections;
        if (totalNonTargets === 0) return 0;

        return Math.round((this._state.stats.falseAlarms / totalNonTargets) * 100);
    }

    _calculateRT() {
        if (this._state.stats.reactionTimes.length === 0) return 0;

        return Math.round(
            this._state.stats.reactionTimes.reduce((a, b) => a + b, 0) /
            this._state.stats.reactionTimes.length
        );
    }

    _calculateDPrime() {
        const hitRate = this._state.stats.hits / (this._state.stats.hits + this._state.stats.misses);
        const falseAlarmRate = this._state.stats.falseAlarms /
            (this._state.stats.falseAlarms + this._state.stats.correctRejections);

        const adjustedHitRate = hitRate === 1 ? 0.99 : (hitRate === 0 ? 0.01 : hitRate);
        const adjustedFARate = falseAlarmRate === 1 ? 0.99 : (falseAlarmRate === 0 ? 0.01 : falseAlarmRate);

        const zHit = this._normalInverse(adjustedHitRate);
        const zFA = this._normalInverse(adjustedFARate);

        return zHit - zFA;
    }

    _normalInverse(p) {
        const a1 = -39.6968302866538;
        const a2 = 220.946098424521;
        const a3 = -275.928510446969;
        const a4 = 138.357751867269;
        const a5 = -30.6647980661472;
        const a6 = 2.50662827745924;

        const b1 = -54.4760987982241;
        const b2 = 161.585836858041;
        const b3 = -155.698979859887;
        const b4 = 66.8013118877197;
        const b5 = -13.2806815528857;

        const x = p - 0.5;

        if (Math.abs(x) <= 0.42) {
            const r = x * x;
            return x * ((((a1 * r + a2) * r + a3) * r + a4) * r + a5) /
                   ((((b1 * r + b2) * r + b3) * r + b4) * r + b5);
        }

        const r = p > 0.5 ? 1 - p : p;
        const s = Math.log(-Math.log(r));
        let t = a6 + s * (a1 + s * (a2 + s * (a3 + s * (a4 + s * a5))))

        return p > 0.5 ? t : -t;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CPTTest();
});