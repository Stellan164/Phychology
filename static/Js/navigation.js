document.addEventListener('DOMContentLoaded', function() {
        // 视频轮播功能
        const videos = [
            document.getElementById('video1'),
            document.getElementById('video2'),
            document.getElementById('video3'),
            document.getElementById('video4')
        ];

        let currentVideoIndex = 0;

        // 设置轮播
        function rotateVideos() {
            videos[currentVideoIndex].classList.remove('active');
            currentVideoIndex = (currentVideoIndex + 1) % videos.length;

            // 先加载下一个视频
            videos[currentVideoIndex].load();
            videos[currentVideoIndex].play();

            // 延迟添加active类以创建平滑过渡
            setTimeout(() => {
                videos[currentVideoIndex].classList.add('active');
            }, 100);
        }

        // 每8秒轮播一次视频
        setInterval(rotateVideos, 8000);

        // 测验相关变量
        let selectedQuiz = null;
        let isQuizCompleted = false;
        const quizData = {
            'examination1': {
                title: '测试一',
                description: '评估您的心理健康状况',
                completed: false,
                report: '根据评估，您的心理健康状况良好。建议保持规律作息和适当运动。'
            },
            'examination2': {
                title: '测试二',
                description: '测量您当前的压力水平',
                completed: false,
                report: '您的压力水平中等。建议尝试冥想或深呼吸练习来缓解压力。'
            }
        };

        // 选择测验
        function selectQuiz(quizId) {
            selectedQuiz = quizId;

            // 更新UI反馈
            document.querySelectorAll('.quiz-link').forEach(link => {
                link.classList.remove('selected');
            });

            document.querySelector(`[data-quiz="${quizId}"]`).classList.add('selected');

            // 显示选择反馈
            showToast(`已选择测验: ${quizData[quizId].title}`);

            // 延迟后模拟完成测验
            setTimeout(() => {
                isQuizCompleted = true;
                quizData[quizId].completed = true;
                showToast(`测验完成: ${quizData[quizId].title}`);

                // 自动显示报告按钮
                document.getElementById('reportBtn').classList.add('pulse');
            }, 2000);
        }

        // 查看报告
        function viewReport() {
            if (!selectedQuiz) {
                showToast('请先完成一个测验', 'error');
                return;
            }

            if (!isQuizCompleted) {
                showToast('测验尚未完成', 'error');
                return;
            }

            const modal = document.getElementById('reportModal');
            const overlay = document.getElementById('overlay');
            const reportContent = document.getElementById('reportContent');

            document.getElementById('reportTitle').textContent = `${quizData[selectedQuiz].title} - 测试报告`;

            reportContent.innerHTML = `
                <div class="report-section">
                    <h3>测验概述</h3>
                    <p>${quizData[selectedQuiz].description}</p>
                </div>
                <div class="report-section">
                    <h3>测验结果</h3>
                    <p>${quizData[selectedQuiz].report}</p>
                    <div class="report-chart">
                        <div class="chart-bar" style="width: ${selectedQuiz === 'examination1' ? '75%' : '60%'}"></div>
                    </div>
                </div>
                <div class="report-section">
                    <h3>建议</h3>
                    <ul>
                        <li>保持规律的作息时间</li>
                        <li>每天进行适量运动</li>
                        <li>与朋友和家人保持良好沟通</li>
                        <li>尝试冥想或深呼吸练习</li>
                    </ul>
                </div>
            `;

            overlay.style.display = 'block';
            modal.style.display = 'block';
        }

        // 关闭报告
        function closeReport() {
            document.getElementById('reportModal').style.display = 'none';
            document.getElementById('overlay').style.display = 'none';
        }

        // 显示Toast通知
        function showToast(message, type = 'success') {
            // 移除现有的Toast
            const existingToasts = document.querySelectorAll('.toast');
            existingToasts.forEach(toast => {
                document.body.removeChild(toast);
            });

            // 创建新的Toast
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            // 显示Toast
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);

            // 隐藏Toast
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        document.body.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }

        // 绑定导航链接点击事件
        document.querySelectorAll('.quiz-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const quizId = this.getAttribute('data-quiz');
                selectQuiz(quizId);

                // 2秒后跳转到测验页面
                setTimeout(() => {
                    window.location.href = this.getAttribute('href');
                }, 2000);
            });
        });

        // 点击遮罩关闭模态框
        document.getElementById('overlay').addEventListener('click', closeReport);
    });