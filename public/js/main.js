// DOM Elements
const serverBtn = document.getElementById('serverBtn');
const helpBtn = document.getElementById('helpBtn');
const rulesBtn = document.getElementById('rulesBtn');
const closeHelp = document.getElementById('closeHelp');
const closeRules = document.getElementById('closeRules');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const helpModal = document.getElementById('helpModal');
const rulesModal = document.getElementById('rulesModal');
const suggestionText = document.getElementById('suggestionText');
const charCount = document.getElementById('charCount');
const sendSuggestionBtn = document.getElementById('sendSuggestion');
const cancelSuggestionBtn = document.getElementById('cancelSuggestion');
const typeBtns = document.querySelectorAll('.type-btn');
const ruleCatBtns = document.querySelectorAll('.rule-cat-btn');
const cards = document.querySelectorAll('.card-item');
const navLinks = document.querySelectorAll('.nav-link');

// Server link from config
const serverLink = 'https://your-server-link.com'; // Replace with actual server link

// Initialize
let currentSuggestionType = 'شكوى';

// Event Listeners
serverBtn.addEventListener('click', () => {
    window.open(serverLink, '_blank');
});

helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
});

rulesBtn.addEventListener('click', () => {
    rulesModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
});

closeHelp.addEventListener('click', () => {
    helpModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    resetSuggestionForm();
});

closeRules.addEventListener('click', () => {
    rulesModal.style.display = 'none';
    document.body.style.overflow = 'auto';
});

closeRulesBtn.addEventListener('click', () => {
    rulesModal.style.display = 'none';
    document.body.style.overflow = 'auto';
});

// Close modals when clicking outside
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        resetSuggestionForm();
    }
});

rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
        rulesModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Suggestion type selection
typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSuggestionType = btn.dataset.type;
    });
});

// Character counter for suggestion text
suggestionText.addEventListener('input', () => {
    const length = suggestionText.value.length;
    charCount.textContent = length;
    
    if (length > 3900) {
        charCount.style.color = 'var(--danger)';
    } else if (length > 3500) {
        charCount.style.color = 'orange';
    } else {
        charCount.style.color = '#B8D4F0';
    }
});

// Send suggestion
sendSuggestionBtn.addEventListener('click', async () => {
    const content = suggestionText.value.trim();
    
    if (!content) {
        alert('الرجاء كتابة نص الاقتراح أو الشكوى');
        return;
    }
    
    if (content.length < 10) {
        alert('الرجاء كتابة نص مفصل أكثر (10 أحرف على الأقل)');
        return;
    }
    
    // Generate a mock user ID (in real app, use actual user ID)
    const userId = 'user_' + Date.now();
    
    try {
        sendSuggestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
        sendSuggestionBtn.disabled = true;
        
        const response = await fetch('/api/send-suggestion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: currentSuggestionType,
                content: content,
                userId: userId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ تم إرسال ' + currentSuggestionType + ' بنجاح!');
            helpModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            resetSuggestionForm();
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ حدث خطأ أثناء الإرسال. الرجاء المحاولة لاحقاً.');
    } finally {
        sendSuggestionBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال';
        sendSuggestionBtn.disabled = false;
    }
});

// Cancel suggestion
cancelSuggestionBtn.addEventListener('click', () => {
    helpModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    resetSuggestionForm();
});

// Rule category selection
ruleCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        ruleCatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Hide all content
        document.querySelectorAll('.rule-category-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected content
        const category = btn.dataset.category;
        const contentElement = document.getElementById(category + '-rules');
        if (contentElement) {
            contentElement.classList.add('active');
        }
    });
});

// Card hover effects
cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.classList.add('active');
    });
    
    card.addEventListener('mouseleave', () => {
        card.classList.remove('active');
    });
    
    card.addEventListener('click', () => {
        // Add your click functionality here
        const cardId = card.dataset.card;
        console.log('Card clicked:', cardId);
    });
});

// Navbar active link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

// Reset suggestion form
function resetSuggestionForm() {
    suggestionText.value = '';
    charCount.textContent = '0';
    charCount.style.color = '#B8D4F0';
    typeBtns[0].classList.add('active');
    currentSuggestionType = 'شكوى';
}

// Close with ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (helpModal.style.display === 'flex') {
            helpModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            resetSuggestionForm();
        }
        if (rulesModal.style.display === 'flex') {
            rulesModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
});

// Set active nav link based on current page
function setActiveNavLink() {
    const currentPage = window.location.pathname;
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    setActiveNavLink();
});