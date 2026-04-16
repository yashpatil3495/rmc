/* ===== EVENTS DATA ===== */
const events = [
    {
        img: "/img/2026.jpeg",
        title: "Digital Treasure Hunt",
        tag: "Technical",
        date: "2026",
        badge: "COMPLETED",
        num: "01",
        stat1: "3", stat1Label: "Rounds",
        stat2: "100+", stat2Label: "Participants",
        desc: "We contributed as event coordinators to Cyber Heist, a technical event organized by the Department of Engineering Sciences and Humanities, supporting the planning and execution of all three rounds. Our responsibilities included framing and curating MCQ questions for Round 1, designing and validating debugging challenges for Round 2, and coordinating the Real Hunt (treasure hunt) in Round 3 by assisting with logistics and execution."
    },
    {
        img: "/img/Expert Talk.jpeg",
        title: "Expert Talk",
        tag: "Cultural",
        date: "2025",
        badge: "PAST",
        num: "02",
        stat1: "1", stat1Label: "Teams",
        stat2: "80+", stat2Label: "Students",
        desc: "Expert Talk on Application of Statistics and probability in Data science by Dr. P. G. Dixit sir"
    },
    {
        img: "/img/2025.jpeg",
        title: "Expert Talk",
        tag: "Cultural",
        date: "2024",
        badge: "PAST",
        num: "03",
        stat1: "1", stat1Label: "Team",
        stat2: "60+", stat2Label: "Students",
        desc: "Expert Session On Vedic Mathematics on occasion of National Mathematics Day Br MRS. Prajakti Gokhle mam  Dirctor Institute of Vedic mathematics UK based NGO."
    }
];

let currentIndex = 0;

/* ===== BUILD RAIL CARDS ===== */
function buildRail() {
    const rail = document.getElementById('railCards');
    const progress = document.getElementById('railProgress');
    rail.innerHTML = '';
    progress.innerHTML = '';

    events.forEach((ev, i) => {
        const card = document.createElement('div');
        card.className = 'rail-card' + (i === currentIndex ? ' active' : '');
        card.innerHTML = `
            <div class="rail-card-img"><img src="${ev.img}" alt="${ev.title}" onerror="this.src='/img/2026.jpeg'"></div>
            <div class="rail-card-info">
                <span class="rail-card-tag">${ev.tag}</span>
                <span class="rail-card-title">${ev.title}</span>
                <span class="rail-card-date">${ev.date}</span>
            </div>
        `;
        card.onclick = () => goToEvent(i);
        rail.appendChild(card);

        const dot = document.createElement('div');
        dot.className = 'progress-dot' + (i === currentIndex ? ' active' : '');
        dot.onclick = () => goToEvent(i);
        progress.appendChild(dot);
    });
}

/* ===== UPDATE FEATURED ===== */
function updateFeatured(animate = true) {
    const ev = events[currentIndex];
    const featured = document.getElementById('featuredCard');

    if (animate) {
        featured.classList.add('transitioning');
        setTimeout(() => featured.classList.remove('transitioning'), 450);
    }

    document.getElementById('featuredImg').src = ev.img;
    document.getElementById('featuredImg').onerror = function(){ this.src='/img/2026.jpeg'; };
    document.getElementById('featuredBadge').textContent = ev.badge;
    document.getElementById('featuredNum').textContent = ev.num;
    document.getElementById('featuredTag').textContent = ev.tag;
    document.getElementById('featuredDate').textContent = ev.date;
    document.getElementById('featuredTitle').textContent = ev.title;
    document.getElementById('featuredDesc').textContent = ev.desc;
    document.getElementById('featuredStat').textContent = ev.stat1;
    document.getElementById('featuredStat2').textContent = ev.stat2;

    document.querySelectorAll('.rail-card').forEach((c, i) => {
        c.classList.toggle('active', i === currentIndex);
    });
    document.querySelectorAll('.progress-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentIndex);
    });

    const ticker = document.getElementById('tickerText');
    ticker.textContent = `NOW VIEWING: ${ev.title.toUpperCase()} — ${ev.tag.toUpperCase()} EVENT — ${ev.date}`;
}

function goToEvent(i) {
    currentIndex = i;
    updateFeatured(true);
}

function nextEvent() {
    currentIndex = (currentIndex + 1) % events.length;
    updateFeatured(true);
}

function prevEvent() {
    currentIndex = (currentIndex - 1 + events.length) % events.length;
    updateFeatured(true);
}

/* ===== AUTO PLAY ===== */
let autoTimer = setInterval(nextEvent, 5000);
document.querySelector('.events-arena').addEventListener('mouseenter', () => clearInterval(autoTimer));
document.querySelector('.events-arena').addEventListener('mouseleave', () => {
    clearInterval(autoTimer);
    autoTimer = setInterval(nextEvent, 5000);
});

/* ===== INIT ===== */
buildRail();
updateFeatured(false);

/* ===== KEYBOARD NAV ===== */
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') nextEvent();
    if (e.key === 'ArrowLeft') prevEvent();
});

/* ===== MENU TOGGLE ===== */
function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active");
}

const sections = document.querySelectorAll('.about-section, .events-section');
window.addEventListener('scroll', () => {
    sections.forEach(sec => {
        const rect = sec.getBoundingClientRect();
        const vh = window.innerHeight;
        let visible = 1 - Math.abs(rect.top - vh / 2) / vh;
        visible = Math.min(Math.max(visible, 0), 1);
        const blur = 6 + visible * 6;
        sec.style.setProperty('--blur', blur + 'px');
    });
});

/* ===== UPCOMING EVENTS — Public Renderer (Firebase Real-time) ===== */
function renderUpcomingEvents(evts) {
    const container = document.getElementById('upcomingCards');
    if (!container) return;

    if (!evts) evts = [];
    if (!Array.isArray(evts)) evts = Object.values(evts);

    const upcoming = evts.filter(ev =>
        ev.status === 'Registration Open' || ev.status === 'Registration Closed'
    );

    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length === 0) {
        container.innerHTML = `
            <div class="upcoming-placeholder">
                <i class='bx bx-calendar-star'></i>
                <p>Stay tuned — exciting events coming soon!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = upcoming.map(ev => {
        const isOpen = ev.status === 'Registration Open';
        const statusClass = isOpen ? 'open' : 'closed';
        const statusText = isOpen ? 'Registration Open' : 'Registration Closed';

        const eventDate = new Date(ev.date);
        const dateStr = eventDate.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const now = new Date();
        const diffMs = eventDate - now;
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let countdownText = '';
        if (daysLeft > 0) {
            countdownText = daysLeft === 1 ? '1 day left' : daysLeft + ' days left';
        } else if (daysLeft === 0) {
            countdownText = 'Today!';
        } else {
            countdownText = 'Event passed';
        }

        let deadlineBadge = '';
        if (ev.deadline) {
            const dl = new Date(ev.deadline);
            const dlStr = dl.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            deadlineBadge = `<span class="upcoming-deadline-badge">Deadline: ${dlStr}</span>`;
        }

        let posterHtml = '';
        if (ev.posterUrl) {
            posterHtml = `<img src="${escapeHtmlAttr(ev.posterUrl)}" alt="${escapeHtmlAttr(ev.name)}" class="upcoming-card-poster" onerror="this.style.display='none'">`;
        }

        const regLink = isOpen ? 'ragister.html?event=' + encodeURIComponent(ev.id || '') : '#';
        const btnClass = isOpen ? '' : ' disabled';
        const btnText = isOpen ? 'REGISTER NOW' : 'CLOSED';
        const target = '';

        return `
            <div class="upcoming-card">
                ${posterHtml}
                <div class="upcoming-card-body">
                    <div class="upcoming-card-meta">
                        <span class="upcoming-card-status ${statusClass}">${statusText}</span>
                        <span class="upcoming-card-date">${dateStr}</span>
                    </div>
                    <h3 class="upcoming-card-title">${escapeHtmlPublic(ev.name)}</h3>
                    <p class="upcoming-card-desc">${escapeHtmlPublic(ev.description)}</p>
                    <div class="upcoming-card-footer">
                        <div>
                            <div class="upcoming-countdown">
                                <i class='bx bx-time-five'></i> ${countdownText}
                            </div>
                            ${deadlineBadge}
                        </div>
                        <a href="${escapeHtmlAttr(regLink)}" ${target} class="upcoming-register-btn${btnClass}">${btnText}</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtmlPublic(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function escapeHtmlAttr(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Use real-time listener instead of setInterval
function initUpcomingEvents() {
    if (window._firebaseReady) {
        fbListen('rmc_events', renderUpcomingEvents);
    } else {
        window.addEventListener('firebaseReady', () => {
            fbListen('rmc_events', renderUpcomingEvents);
        });
    }
}
initUpcomingEvents();

/* ===== ANNOUNCEMENT BANNER — Public Renderer (Firebase Real-time) ===== */
function renderAnnouncementBanner(data) {
    const banner = document.getElementById('announcementBanner');
    const content = document.getElementById('announcementContent');
    if (!banner || !content) return;

    if (sessionStorage.getItem('rmc_banner_dismissed') === 'true') {
        banner.style.display = 'none';
        return;
    }

    if (!data || !data.active || !data.message) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'flex';
    banner.style.background = data.color || '#c9a84c';

    if (data.scrolling) {
        content.innerHTML = '<span class="announcement-scroll-text" style="color:' +
            (data.textColor || '#000000') + ';">' +
            escapeHtmlPublic(data.message) + '</span>';
    } else {
        content.innerHTML = '<span class="announcement-static-text" style="color:' +
            (data.textColor || '#000000') + ';">' +
            escapeHtmlPublic(data.message) + '</span>';
    }
}

function dismissBanner() {
    sessionStorage.setItem('rmc_banner_dismissed', 'true');
    const banner = document.getElementById('announcementBanner');
    if (banner) {
        banner.style.animation = 'bannerSlideUp 0.3s ease forwards';
        setTimeout(() => { banner.style.display = 'none'; }, 300);
    }
}

function initAnnouncementBanner() {
    if (window._firebaseReady) {
        fbListen('rmc_announcement', renderAnnouncementBanner);
    } else {
        window.addEventListener('firebaseReady', () => {
            fbListen('rmc_announcement', renderAnnouncementBanner);
        });
    }
}
initAnnouncementBanner();

/* ===== MEMBERS PREVIEW — Public Renderer (Firebase Real-time) ===== */
function renderMembersPreview(members) {
    const grid = document.getElementById('membersPreviewGrid');
    if (!grid) return;

    if (!members) members = [];
    if (!Array.isArray(members)) members = Object.values(members);

    if (members.length === 0) {
        grid.innerHTML = '';
        return;
    }

    const typeOrder = { 'Faculty Advisor': 0, 'Core Committee': 1, 'General Member': 2 };
    members.sort((a, b) => {
        const orderA = typeOrder[a.memberType] !== undefined ? typeOrder[a.memberType] : 3;
        const orderB = typeOrder[b.memberType] !== undefined ? typeOrder[b.memberType] : 3;
        return orderA - orderB;
    });

    const preview = members.slice(0, 10);

    grid.innerHTML = preview.map(m => {
        const photo = (m.photoData && m.photoData.trim())
            ? m.photoData
            : (m.photoUrl && m.photoUrl.trim())
            ? m.photoUrl
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name) +
              '&background=c9a84c&color=0a0a0a&size=128&bold=true';

        let subtitleHtml = '';
        if (m.qualification && m.qualification.trim()) {
            subtitleHtml = '<p class="mp-card-qualification">' + escapeHtmlPublic(m.qualification) + '</p>';
        } else {
            const parts = [m.year, m.department].filter(Boolean);
            if (parts.length > 0) {
                subtitleHtml = '<p class="mp-card-detail">' + escapeHtmlPublic(parts.join(' • ')) + '</p>';
            }
        }

        const typeBadge = m.memberType === 'Faculty Advisor'
            ? '<span class="mp-card-badge">Faculty</span>' : '';

        return `
            <div class="mp-card">
                ${typeBadge}
                <img src="${escapeHtmlAttr(photo)}" alt="${escapeHtmlAttr(m.name)}" class="mp-card-photo"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=c9a84c&color=0a0a0a&size=128'">
                <h4 class="mp-card-name">${escapeHtmlPublic(m.name)}</h4>
                <p class="mp-card-role">${escapeHtmlPublic(m.role)}</p>
                ${subtitleHtml}
            </div>
        `;
    }).join('');
}

// renderMembersPreview(); // Disabled - members only show on members.html after clicking VIEW ALL MEMBERS button
