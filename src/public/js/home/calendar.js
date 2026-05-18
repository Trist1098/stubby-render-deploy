document.addEventListener('DOMContentLoaded', async () => {
    if (!auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    const monthTitle = document.getElementById('monthTitle');
    const calendarGrid = document.getElementById('calendarGrid');
    const eventList = document.getElementById('eventList');
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');

    let currentDate = new Date();
    let events = [];

    const loadEvents = async () => {
        const response = await apiRequest('/api/calendar');
        if (response && response.events) {
            events = response.events;
            renderEvents();
            renderCalendar();
        } else {
            eventList.innerHTML = '<div class="text-danger">Unable to load calendar events.</div>';
        }
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = getDaysInMonth(year, month);

        monthTitle.textContent = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        calendarGrid.innerHTML = '';

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-cell';
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.filter((event) => event.date === dateString);
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            if (dateString === new Date().toISOString().slice(0, 10)) {
                cell.classList.add('calendar-cell--today');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'fw-bold mb-2';
            dayNumber.textContent = day;
            cell.appendChild(dayNumber);

            dayEvents.slice(0, 2).forEach((event) => {
                const eventPill = document.createElement('span');
                eventPill.className = 'event-pill';
                eventPill.textContent = `${event.start} ${event.title}`;
                cell.appendChild(eventPill);
            });

            calendarGrid.appendChild(cell);
        }
    };

    const renderEvents = () => {
        if (!events.length) {
            eventList.innerHTML = '<div class="text-muted">No upcoming events.</div>';
            return;
        }

        eventList.innerHTML = '';
        const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
        sorted.forEach((event) => {
            const item = document.createElement('div');
            item.className = 'list-group-item list-group-item-action mb-2 rounded-3';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${event.title}</h6>
                        <p class="mb-1 text-muted small">${event.date} · ${event.start} — ${event.end}</p>
                    </div>
                </div>
                <p class="mb-0 text-muted">${event.description}</p>
            `;
            eventList.appendChild(item);
        });
    };

    prevMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    await loadEvents();
});
