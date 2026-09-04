// ==========================================
// Canvas Confetti Particle Engine
// ==========================================
const RetroConfetti = {
            canvas: null,
            ctx: null,
            particles: [],
            animId: null,
            colors: ['#ff5f1f', '#10b981', '#1a1a1a', '#fdfaf6', '#3b82f6', '#fbbf24'],

            init() {
                this.canvas = document.getElementById('confettiCanvas');
                if (!this.canvas) return;
                this.ctx = this.canvas.getContext('2d');
                window.addEventListener('resize', () => this.resize());
                this.resize();
            },

            resize() {
                if (!this.canvas) return;
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            },

            fire(opts = {}) {
                if (!this.canvas) this.init();
                if (!this.canvas || !this.ctx) return;

                this.canvas.style.display = 'block';
                const count = opts.particleCount || 70;
                const originX = opts.x !== undefined ? opts.x : window.innerWidth / 2;
                const originY = opts.y !== undefined ? opts.y : window.innerHeight * 0.45;

                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = (opts.spread || 1) * (3 + Math.random() * 8);
                    this.particles.push({
                        x: originX,
                        y: originY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 3.5,
                        size: Math.floor(7 + Math.random() * 8),
                        color: this.colors[Math.floor(Math.random() * this.colors.length)],
                        rotation: Math.random() * 360,
                        rotSpeed: (Math.random() - 0.5) * 12,
                        opacity: 1,
                        decay: 0.009 + Math.random() * 0.014
                    });
                }

                if (!this.animId) {
                    this.loop();
                }
            },

            loop() {
                if (this.particles.length === 0) {
                    if (this.ctx && this.canvas) {
                        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                        this.canvas.style.display = 'none';
                    }
                    this.animId = null;
                    return;
                }

                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

                for (let i = this.particles.length - 1; i >= 0; i--) {
                    const p = this.particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.28;
                    p.vx *= 0.98;
                    p.rotation += p.rotSpeed;
                    p.opacity -= p.decay;

                    if (p.opacity <= 0 || p.y > this.canvas.height + 50) {
                        this.particles.splice(i, 1);
                        continue;
                    }

                    this.ctx.save();
                    this.ctx.globalAlpha = Math.max(0, p.opacity);
                    this.ctx.translate(p.x, p.y);
                    this.ctx.rotate((p.rotation * Math.PI) / 180);

                    this.ctx.fillStyle = p.color;
                    this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    this.ctx.lineWidth = 1.5;
                    this.ctx.strokeStyle = '#1a1a1a';
                    this.ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);

                    this.ctx.restore();
                }

                this.animId = requestAnimationFrame(() => this.loop());
            }
        };