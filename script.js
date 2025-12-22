// Simple interactive effects for tickets
document.addEventListener('DOMContentLoaded', () => {
    const tickets = document.querySelectorAll('.ticket');
    
    tickets.forEach(ticket => {
        // Add click/tap effect
        ticket.addEventListener('click', () => {
            ticket.style.transform = 'scale(0.98)';
            setTimeout(() => {
                ticket.style.transform = '';
            }, 150);
        });
    });
});

