// Wait for all required libraries to load
window.addEventListener('DOMContentLoaded', function() {
  // Load required libraries dynamically if not already loaded
  if (!window.THREE) {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', initAll);
  } else {
    initAll();
  }

  if (!window.Swiper) {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/Swiper/8.0.0/swiper-bundle.min.js');
  }
});

function loadScript(url, callback) {
  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
}

function initAll() {
  preloadImages();
  initSwiper();
  initBrainModel();
  setupEventListeners();
}

// Improved image preloading with error handling
function preloadImages() {
  const images = [
    'https://images.unsplash.com/photo-1548407260-da850faa41e3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'
  ];

  images.forEach(img => {
    const image = new Image();
    image.src = img;
    image.onerror = () => console.warn('Failed to load image:', img);
  });
}

// Enhanced brain model initialization with cleanup
let brainScene, brainCamera, brainRenderer, brainControls, brainAnimationId;

function initBrainModel() {
  const container = document.getElementById('brain-model');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Create scene
  brainScene = new THREE.Scene();
  brainScene.background = new THREE.Color(0xf5f3ff);

  // Create camera
  brainCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  brainCamera.position.z = 5;

  // Create renderer
  brainRenderer = new THREE.WebGLRenderer({ antialias: true });
  brainRenderer.setSize(width, height);
  brainRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(brainRenderer.domElement);

  // Add orbit controls
  brainControls = new THREE.OrbitControls(brainCamera, brainRenderer.domElement);
  brainControls.enableDamping = true;
  brainControls.dampingFactor = 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  brainScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  brainScene.add(directionalLight);

  // Create brain model
  const geometry = new THREE.SphereGeometry(2, 32, 32);
  const textureLoader = new THREE.TextureLoader();

  textureLoader.load(
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80',
    (texture) => {
      const material = new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
        color: 0x6d28d9
      });

      const brain = new THREE.Mesh(geometry, material);
      brainScene.add(brain);

      // Start animation
      animateBrain(brain);
    },
    undefined,
    (error) => {
      console.error('Error loading texture:', error);
      // Fallback to basic material if texture fails
      const material = new THREE.MeshPhongMaterial({
        color: 0x6d28d9,
        shininess: 100,
        transparent: true,
        opacity: 0.9
      });
      const brain = new THREE.Mesh(geometry, material);
      brainScene.add(brain);
      animateBrain(brain);
    }
  );

  // Responsive handling
  window.addEventListener('resize', handleBrainResize);
}

function animateBrain(brain) {
  const animate = () => {
    brainAnimationId = requestAnimationFrame(animate);
    if (brain) brain.rotation.y += 0.005;
    if (brainControls) brainControls.update();
    if (brainRenderer && brainScene && brainCamera) {
      brainRenderer.render(brainScene, brainCamera);
    }
  };
  animate();
}

function handleBrainResize() {
  const container = document.getElementById('brain-model');
  if (!container || !brainCamera || !brainRenderer) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  brainCamera.aspect = width / height;
  brainCamera.updateProjectionMatrix();
  brainRenderer.setSize(width, height);
}

function cleanupBrainModel() {
  if (brainAnimationId) {
    cancelAnimationFrame(brainAnimationId);
  }

  const container = document.getElementById('brain-model');
  if (container && brainRenderer) {
    container.removeChild(brainRenderer.domElement);
  }

  window.removeEventListener('resize', handleBrainResize);

  // Dispose of Three.js objects
  if (brainRenderer) brainRenderer.dispose();
  if (brainControls) brainControls.dispose();
}

// Enhanced Swiper initialization
function initSwiper() {
  const swiperEl = document.querySelector('.swiper');
  if (!swiperEl) return;

  const swiper = new Swiper('.swiper', {
    direction: 'vertical',
    loop: true,
    speed: 800,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    on: {
      init: animateElements,
      slideChangeTransitionEnd: animateElements
    }
  });
}

// 改进的动画系统
function animateElements() {
  const elements = document.querySelectorAll('.animate');
  const windowHeight = window.innerHeight;
  const triggerOffset = windowHeight * 0.8; // 触发动画的偏移量

  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top;
    const elementBottom = rect.bottom;

    // 检查元素是否在视口中
    const isInView = elementTop < triggerOffset && elementBottom > 0;

    if (isInView) {
      // 添加动画类
      element.classList.add('animated');
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    } else if (elementTop > windowHeight) {
      // 如果元素完全离开视口下方，重置动画状态
      element.classList.remove('animated');
      element.style.opacity = '0';
      element.style.transform = 'translateY(20px)';
    }
    // 如果元素在视口上方离开，保持当前状态
  });
}

// Debounce function to limit the rate of function calls
function debounce(func, wait = 10) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 添加平滑过渡的CSS
const style = document.createElement('style');
style.textContent = `
  .animate {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s ease, transform 0.5s ease;
    will-change: opacity, transform;
  }

  .animate.animated {
    opacity: 1;
    transform: translateY(0);
  }
`;
document.head.appendChild(style);

// 修改 setupEventListeners 函数
function setupEventListeners() {
  // Mobile menu toggle
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      menuBtn.innerHTML = navLinks.classList.contains('active') ?
        '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
  }

  // Smooth scrolling
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();

      if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
        if (menuBtn) menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
      }

      const targetId = this.getAttribute('href');
      if (targetId === '#home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Meditation player with proper cleanup
  const playBtns = document.querySelectorAll('.play-btn');
  const progressBars = document.querySelectorAll('.progress');
  const audioPlayers = [
    document.getElementById('track1'),
    document.getElementById('track2')
  ];

  // 总时长（毫秒）
  const TOTAL_DURATION = 10 * 60 * 1000; // 10分钟 = 600,000ms
  const PROGRESS_UPDATE_INTERVAL = 100; // 进度条更新间隔（毫秒）

  playBtns.forEach((btn, index) => {
    let isPlaying = false;
    let progressInterval = null;
    const audio = audioPlayers[index];
    const progress = progressBars[index];

    if (btn && audio && progress) {
      btn.addEventListener('click', function() {
        isPlaying = !isPlaying;

        if (isPlaying) {
          audio.play();
          btn.innerHTML = '<i class="fas fa-pause"></i>';
          let startTime = Date.now();

          if (progressInterval) clearInterval(progressInterval);
          progressInterval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progressPercent = (elapsedTime / TOTAL_DURATION) * 100;

            progress.style.width = `${progressPercent}%`;

            if (progressPercent >= 100) {
              clearInterval(progressInterval);
              isPlaying = false;
              audio.pause();
              btn.innerHTML = '<i class="fas fa-play"></i>';
              progress.style.width = '0%';
            }
          }, PROGRESS_UPDATE_INTERVAL);
        } else {
          btn.innerHTML = '<i class="fas fa-play"></i>';
          audio.pause();
          if (progressInterval) clearInterval(progressInterval);
        }
      });

      audio.addEventListener('ended', () => {
        isPlaying = false;
        btn.innerHTML = '<i class="fas fa-play"></i>';
        progress.style.width = '0%';
        if (progressInterval) clearInterval(progressInterval);
      });
    }
  });

  // 添加滚动和调整大小事件监听器
  const debouncedAnimateElements = debounce(animateElements);
  window.addEventListener('scroll', debouncedAnimateElements);
  window.addEventListener('resize', debouncedAnimateElements);

  // 初始动画检查
  animateElements();
}

// Cleanup when leaving page
window.addEventListener('beforeunload', function() {
  cleanupBrainModel();
});