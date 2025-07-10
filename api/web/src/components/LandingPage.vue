<template>
    <div class="landing-page">
        <!-- Hero Section -->
        <section class="hero-section">
            <div class="hero-background"></div>
            <div class="container">
                <div class="row align-items-center min-vh-100">
                    <div class="col-lg-6">
                        <div class="hero-content">
                            <img 
                                src="/CloudTAKLogoText.svg" 
                                alt="CloudTAK" 
                                class="hero-logo mb-4"
                            >
                            <h1 class="hero-title">
                                Next-Generation
                                <span class="text-gradient">Tactical Awareness</span>
                                in the Cloud
                            </h1>
                            <p class="hero-subtitle">
                                CloudTAK delivers real-time situational awareness for military and emergency response teams with cloud-native scalability, advanced data fusion, and seamless interoperability.
                            </p>
                            <div class="hero-actions">
                                <button 
                                    class="btn btn-primary btn-lg me-3"
                                    @click="router.push('/login')"
                                >
                                    Access Platform
                                </button>
                                <button 
                                    class="btn btn-outline-light btn-lg"
                                    @click="scrollToSection('features')"
                                >
                                    Learn More
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="hero-visual">
                            <div class="tactical-display">
                                <div class="display-frame">
                                    <div class="display-content">
                                        <div class="map-placeholder">
                                            <div class="tactical-overlay">
                                                <div class="unit-marker unit-1"></div>
                                                <div class="unit-marker unit-2"></div>
                                                <div class="unit-marker unit-3"></div>
                                                <div class="comm-lines"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section id="features" class="features-section">
            <div class="container">
                <div class="row">
                    <div class="col-12 text-center mb-5">
                        <h2 class="section-title">
                            Mission-Critical Capabilities
                        </h2>
                        <p class="section-subtitle">
                            Advanced cloud infrastructure powering next-generation tactical operations
                        </p>
                    </div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-4 col-md-6">
                        <div class="feature-card">
                            <div class="feature-icon">
                                <i class="fas fa-cloud"></i>
                            </div>
                            <h3>Cloud-Native Architecture</h3>
                            <p>Built on AWS with infinite scalability, global deployment, and enterprise-grade security for mission-critical operations.</p>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="feature-card">
                            <div class="feature-icon">
                                <i class="fas fa-globe-americas"></i>
                            </div>
                            <h3>Real-Time Situational Awareness</h3>
                            <p>Live tactical picture with real-time data fusion from multiple sources, ensuring complete battlefield visibility.</p>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="feature-card">
                            <div class="feature-icon">
                                <i class="fas fa-network-wired"></i>
                            </div>
                            <h3>Seamless Interoperability</h3>
                            <p>Native TAK protocol support with advanced ETL capabilities for integrating diverse data sources and legacy systems.</p>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="feature-card">
                            <div class="feature-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <h3>Enterprise Security</h3>
                            <p>Military-grade security with end-to-end encryption, zero-trust architecture, and compliance with defense standards.</p>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="feature-card">
                            <div class="feature-icon">
                                <i class="fas fa-mobile-alt"></i>
                            </div>
                            <h3>Multi-Platform Access</h3>
                            <p>Access from any device with full-featured web client, mobile compatibility, and offline synchronization capabilities.</p>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="feature-card">
                            <div class="feature-icon">
                                <i class="fas fa-cogs"></i>
                            </div>
                            <h3>Advanced Analytics</h3>
                            <p>AI-powered insights, predictive analytics, and automated threat detection for enhanced decision-making capabilities.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Technology Section -->
        <section class="tech-section">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-6 mb-4 mb-lg-0">
                        <h2 class="section-title">
                            Powered by Advanced Technology
                        </h2>
                        <p class="tech-description">
                            CloudTAK leverages cutting-edge cloud technologies and proven military standards to deliver unparalleled tactical awareness and operational effectiveness.
                        </p>
                        <div class="tech-specs">
                            <div class="spec-item">
                                <strong>AWS Infrastructure:</strong> Elastic scalability with global edge computing
                            </div>
                            <div class="spec-item">
                                <strong>TAK Protocol:</strong> Native support for Team Awareness Kit standards
                            </div>
                            <div class="spec-item">
                                <strong>Real-Time Sync:</strong> Sub-second data synchronization across all platforms
                            </div>
                            <div class="spec-item">
                                <strong>Data Fusion:</strong> Advanced ETL for multi-source intelligence integration
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="tech-visual">
                            <div class="tech-grid">
                                <div class="tech-node active">
                                    <div class="node-label">AWS Cloud</div>
                                </div>
                                <div class="tech-node">
                                    <div class="node-label">Data Sources</div>
                                </div>
                                <div class="tech-node">
                                    <div class="node-label">Mobile Clients</div>
                                </div>
                                <div class="tech-node active">
                                    <div class="node-label">TAK Server</div>
                                </div>
                                <div class="tech-connections"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Use Cases Section -->
        <section class="use-cases-section">
            <div class="container">
                <div class="row">
                    <div class="col-12 text-center mb-5">
                        <h2 class="section-title">
                            Mission-Proven Applications
                        </h2>
                        <p class="section-subtitle">
                            Deployed across military, emergency response, and critical infrastructure operations
                        </p>
                    </div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="use-case-card">
                            <div class="use-case-icon military">
                                <i class="fas fa-fighter-jet"></i>
                            </div>
                            <h3>Military Operations</h3>
                            <p>Enhanced battlefield awareness for joint operations, mission planning, and force coordination with real-time intelligence sharing.</p>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="use-case-card">
                            <div class="use-case-icon emergency">
                                <i class="fas fa-ambulance"></i>
                            </div>
                            <h3>Emergency Response</h3>
                            <p>Coordinated disaster response with multi-agency communications, resource tracking, and incident command integration.</p>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="use-case-card">
                            <div class="use-case-icon security">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <h3>Critical Infrastructure</h3>
                            <p>Protecting vital assets with comprehensive monitoring, threat assessment, and automated response capabilities.</p>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="use-case-card">
                            <div class="use-case-icon logistics">
                                <i class="fas fa-shipping-fast"></i>
                            </div>
                            <h3>Logistics & Supply Chain</h3>
                            <p>End-to-end visibility of critical supplies, equipment tracking, and automated logistics coordination.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="cta-section">
            <div class="container">
                <div class="row">
                    <div class="col-12 text-center">
                        <h2 class="cta-title">
                            Ready to Deploy CloudTAK?
                        </h2>
                        <p class="cta-subtitle">
                            Experience next-generation tactical awareness with enterprise-grade security and reliability.
                        </p>
                        <div class="cta-actions">
                            <button 
                                class="btn btn-primary btn-lg me-3"
                                @click="router.push('/login')"
                            >
                                Access Platform
                            </button>
                            <button class="btn btn-outline-light btn-lg">
                                Contact Sales
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="landing-footer">
            <div class="container">
                <div class="row">
                    <div class="col-md-6">
                        <img 
                            src="/CloudTAKLogoText.svg" 
                            alt="CloudTAK" 
                            class="footer-logo mb-3"
                        >
                        <p class="footer-text">
                            Advanced tactical awareness platform for mission-critical operations.
                        </p>
                    </div>
                    <div class="col-md-6">
                        <div class="footer-links">
                            <a href="#" class="footer-link">Documentation</a>
                            <a href="#" class="footer-link">Support</a>
                            <a href="#" class="footer-link">Security</a>
                            <a href="#" class="footer-link">Contact</a>
                        </div>
                    </div>
                </div>
                <div class="row mt-4 pt-4 border-top border-dark">
                    <div class="col-12 text-center">
                        <p class="footer-copyright">
                            © 2024 CloudTAK by DFPC Center of Excellence. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    </div>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';

const router = useRouter();

function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}
</script>

<style lang='scss' scoped>
// Color variables based on existing CloudTAK design
$cloudtak-yellow: #FFB703;
$cloudtak-orange: #FF9820;
$cloudtak-navy: #023047;
$cloudtak-blue: #07556D;
$dark-bg: #0a0f1c;
$darker-bg: #060a12;

.landing-page {
    background: $darker-bg;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

// Hero Section
.hero-section {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background: linear-gradient(135deg, $cloudtak-navy 0%, $darker-bg 100%);
    
    .hero-background {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: 
            radial-gradient(circle at 20% 80%, rgba($cloudtak-blue, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba($cloudtak-orange, 0.2) 0%, transparent 50%);
    }
    
    .hero-content {
        position: relative;
        z-index: 2;
    }
    
    .hero-logo {
        height: 60px;
        filter: drop-shadow(0 0 20px rgba($cloudtak-yellow, 0.3));
    }
    
    .hero-title {
        font-size: 3.5rem;
        font-weight: 700;
        line-height: 1.1;
        margin-bottom: 1.5rem;
        
        .text-gradient {
            background: linear-gradient(135deg, $cloudtak-yellow, $cloudtak-orange);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    }
    
    .hero-subtitle {
        font-size: 1.25rem;
        line-height: 1.6;
        color: rgba(white, 0.8);
        margin-bottom: 2rem;
        max-width: 500px;
    }
    
    .hero-actions {
        margin-top: 2rem;
    }
}

.hero-visual {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
}

.tactical-display {
    position: relative;
    width: 400px;
    height: 300px;
}

.display-frame {
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba($cloudtak-navy, 0.8);
    border: 2px solid $cloudtak-blue;
    border-radius: 12px;
    box-shadow: 
        0 0 30px rgba($cloudtak-blue, 0.3),
        inset 0 0 20px rgba($cloudtak-blue, 0.1);
    overflow: hidden;
}

.display-content {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    background: $darker-bg;
    border-radius: 8px;
}

.map-placeholder {
    width: 100%;
    height: 100%;
    background: 
        radial-gradient(circle at 30% 30%, rgba($cloudtak-blue, 0.2) 0%, transparent 30%),
        radial-gradient(circle at 70% 70%, rgba($cloudtak-orange, 0.1) 0%, transparent 30%);
    position: relative;
    overflow: hidden;
}

.tactical-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.unit-marker {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: $cloudtak-yellow;
    box-shadow: 0 0 10px rgba($cloudtak-yellow, 0.6);
    animation: pulse 2s infinite;
    
    &.unit-1 {
        top: 30%;
        left: 25%;
        animation-delay: 0s;
    }
    
    &.unit-2 {
        top: 60%;
        right: 30%;
        animation-delay: 0.7s;
    }
    
    &.unit-3 {
        bottom: 25%;
        left: 40%;
        animation-delay: 1.4s;
    }
}

// Features Section
.features-section {
    padding: 120px 0;
    background: $dark-bg;
}

.section-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
}

.section-subtitle {
    font-size: 1.2rem;
    color: rgba(white, 0.7);
    max-width: 600px;
    margin: 0 auto;
}

.feature-card {
    background: rgba($cloudtak-navy, 0.3);
    border: 1px solid rgba($cloudtak-blue, 0.3);
    border-radius: 12px;
    padding: 2rem;
    height: 100%;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-5px);
        border-color: $cloudtak-blue;
        box-shadow: 0 10px 30px rgba($cloudtak-blue, 0.2);
    }
}

.feature-icon {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, $cloudtak-orange, $cloudtak-yellow);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    
    i {
        font-size: 1.5rem;
        color: white;
    }
}

.feature-card h3 {
    font-size: 1.3rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: white;
}

.feature-card p {
    color: rgba(white, 0.8);
    line-height: 1.6;
}

// Technology Section
.tech-section {
    padding: 120px 0;
    background: linear-gradient(135deg, $darker-bg 0%, $cloudtak-navy 100%);
}

.tech-description {
    font-size: 1.1rem;
    color: rgba(white, 0.8);
    line-height: 1.6;
    margin-bottom: 2rem;
}

.tech-specs {
    .spec-item {
        padding: 1rem 0;
        border-bottom: 1px solid rgba($cloudtak-blue, 0.2);
        color: rgba(white, 0.9);
        
        strong {
            color: $cloudtak-yellow;
        }
    }
}

.tech-visual {
    display: flex;
    justify-content: center;
    align-items: center;
}

.tech-grid {
    position: relative;
    width: 300px;
    height: 300px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 2rem;
}

.tech-node {
    position: relative;
    width: 100px;
    height: 100px;
    background: rgba($cloudtak-navy, 0.6);
    border: 2px solid rgba($cloudtak-blue, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &.active {
        border-color: $cloudtak-yellow;
        box-shadow: 0 0 20px rgba($cloudtak-yellow, 0.3);
        animation: pulse 3s infinite;
    }
    
    .node-label {
        font-size: 0.8rem;
        font-weight: 600;
        text-align: center;
        color: white;
    }
}

// Use Cases Section
.use-cases-section {
    padding: 120px 0;
    background: $dark-bg;
}

.use-case-card {
    background: rgba($cloudtak-navy, 0.3);
    border: 1px solid rgba($cloudtak-blue, 0.3);
    border-radius: 12px;
    padding: 2.5rem;
    height: 100%;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-5px);
        border-color: $cloudtak-blue;
        box-shadow: 0 10px 30px rgba($cloudtak-blue, 0.2);
    }
}

.use-case-icon {
    width: 80px;
    height: 80px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    
    &.military {
        background: linear-gradient(135deg, #4F46E5, #7C3AED);
    }
    
    &.emergency {
        background: linear-gradient(135deg, #DC2626, #EA580C);
    }
    
    &.security {
        background: linear-gradient(135deg, #059669, #0D9488);
    }
    
    &.logistics {
        background: linear-gradient(135deg, $cloudtak-orange, $cloudtak-yellow);
    }
    
    i {
        font-size: 2rem;
        color: white;
    }
}

.use-case-card h3 {
    font-size: 1.4rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: white;
}

.use-case-card p {
    color: rgba(white, 0.8);
    line-height: 1.6;
}

// CTA Section
.cta-section {
    padding: 120px 0;
    background: linear-gradient(135deg, $cloudtak-navy 0%, $darker-bg 100%);
    text-align: center;
}

.cta-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
}

.cta-subtitle {
    font-size: 1.2rem;
    color: rgba(white, 0.8);
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.cta-actions {
    margin-top: 2rem;
}

// Footer
.landing-footer {
    padding: 60px 0 30px;
    background: $darker-bg;
    border-top: 1px solid rgba($cloudtak-blue, 0.2);
}

.footer-logo {
    height: 40px;
    filter: opacity(0.8);
}

.footer-text {
    color: rgba(white, 0.6);
    max-width: 300px;
    margin-bottom: 0;
}

.footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    justify-content: flex-end;
    
    @media (max-width: 768px) {
        justify-content: flex-start;
        margin-top: 2rem;
    }
}

.footer-link {
    color: rgba(white, 0.7);
    text-decoration: none;
    transition: color 0.3s ease;
    
    &:hover {
        color: $cloudtak-yellow;
    }
}

.footer-copyright {
    color: rgba(white, 0.5);
    font-size: 0.9rem;
    margin: 0;
}

// Buttons
.btn-primary {
    background: linear-gradient(135deg, $cloudtak-orange, $cloudtak-yellow);
    border: none;
    padding: 1rem 2rem;
    font-weight: 600;
    border-radius: 8px;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba($cloudtak-orange, 0.3);
        background: linear-gradient(135deg, darken($cloudtak-orange, 5%), darken($cloudtak-yellow, 5%));
    }
}

.btn-outline-light {
    border: 2px solid rgba(white, 0.3);
    color: white;
    padding: 1rem 2rem;
    font-weight: 600;
    border-radius: 8px;
    transition: all 0.3s ease;
    
    &:hover {
        background: rgba(white, 0.1);
        border-color: white;
        transform: translateY(-2px);
    }
}

// Animations
@keyframes pulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.7;
        transform: scale(1.1);
    }
}

// Responsive Design
@media (max-width: 768px) {
    .hero-title {
        font-size: 2.5rem;
    }
    
    .hero-subtitle {
        font-size: 1.1rem;
    }
    
    .section-title {
        font-size: 2rem;
    }
    
    .hero-actions .btn {
        display: block;
        width: 100%;
        margin-bottom: 1rem;
        
        &:last-child {
            margin-bottom: 0;
        }
    }
    
    .cta-actions .btn {
        display: block;
        width: 100%;
        margin-bottom: 1rem;
        
        &:last-child {
            margin-bottom: 0;
        }
    }
    
    .tactical-display {
        width: 300px;
        height: 225px;
    }
}
</style>