document.addEventListener("DOMContentLoaded", function () {
  const dateTimeOptions = {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    time_24hr: true,
    locale: {
      weekdays: {
        shorthand: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
        longhand: [
          "Chủ Nhật",
          "Thứ Hai",
          "Thứ Ba",
          "Thứ Tư",
          "Thứ Năm",
          "Thứ Sáu",
          "Thứ Bảy",
        ],
      },
      months: {
        shorthand: [
          "Th.1",
          "Th.2",
          "Th.3",
          "Th.4",
          "Th.5",
          "Th.6",
          "Th.7",
          "Th.8",
          "Th.9",
          "Th.10",
          "Th.11",
          "Th.12",
        ],
        longhand: [
          "Tháng 1",
          "Tháng 2",
          "Tháng 3",
          "Tháng 4",
          "Tháng 5",
          "Tháng 6",
          "Tháng 7",
          "Tháng 8",
          "Tháng 9",
          "Tháng 10",
          "Tháng 11",
          "Tháng 12",
        ],
      },
      firstDayOfWeek: 1,
      rangeSeparator: " đến ",
      time_24hr: true,
    },
  };

  flatpickr("#eventStart", dateTimeOptions);
  flatpickr("#eventEnd", dateTimeOptions);
  document.getElementById("eventAllDay")
  .addEventListener("change", function() {
    const startPicker = document.querySelector("#eventStart")._flatpickr;
    const endPicker = document.querySelector("#eventEnd")._flatpickr;
    
    if (this.checked) {
      startPicker.set("enableTime", false);
      startPicker.set("dateFormat", "Y-m-d");
      endPicker.set("enableTime", false);
      endPicker.set("dateFormat", "Y-m-d");
      const startDate = startPicker.selectedDates[0];
      if (startDate) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endPicker.setDate(endDate);
      }
    } else {
      startPicker.set("enableTime", true);
      startPicker.set("dateFormat", "Y-m-d H:i");
      endPicker.set("enableTime", true);
      endPicker.set("dateFormat", "Y-m-d H:i");
    }
  });
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    initialView: "dayGridMonth",
    locale: "vi",
    buttonText: {
      today: "Hôm nay",
      month: "Tháng",
      week: "Tuần",
      day: "Ngày",
    },
    nowIndicator: true,
    navLinks: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    events: "/api/calendar/events",
    eventChange: function (info) {
      saveEventToDatabase(info.event);
    },
    eventClick: function (info) {
      displayEventModal(info.event);
    },
    select: function (info) {
      document.getElementById("eventForm").reset();
      const startPicker = document.querySelector("#eventStart")._flatpickr;
      const endPicker = document.querySelector("#eventEnd")._flatpickr;

      startPicker.setDate(info.start);
      if (info.end) {
        endPicker.setDate(info.end);
      }

      document.getElementById("eventAllDay").checked = info.allDay;
if (info.allDay) {
  startPicker.set("enableTime", false);
  startPicker.set("dateFormat", "Y-m-d");
  endPicker.set("enableTime", false);
  endPicker.set("dateFormat", "Y-m-d");

  const startDate = startPicker.selectedDates[0];
  if (startDate && (!info.end || info.start.toDateString() === info.end.toDateString())) {
    const endDate = new Date(startDate);
    endPicker.setDate(endDate);
  }
}

      document.getElementById("eventId").value = "";
      document.getElementById("deleteEventBtn").style.display = "none";
      const eventModal = new bootstrap.Modal(
        document.getElementById("eventModal")
      );
      eventModal.show();
    },
  });

  calendar.render();
  document.getElementById("createEvent").addEventListener("click", function () {
    document.getElementById("eventForm").reset();
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const startPicker = document.querySelector("#eventStart")._flatpickr;
    const endPicker = document.querySelector("#eventEnd")._flatpickr;

    startPicker.setDate(now);
    endPicker.setDate(oneHourLater);

    document.getElementById("eventId").value = "";
    document.getElementById("deleteEventBtn").style.display = "none";
    const eventModal = new bootstrap.Modal(
      document.getElementById("eventModal")
    );
    eventModal.show();
  });
  document.getElementById("saveEventBtn").addEventListener("click", function() {
    const eventId = document.getElementById("eventId").value;
    const title = document.getElementById("eventTitle").value;
    const type = document.getElementById("eventType").value;
    const start = document.querySelector("#eventStart")._flatpickr.selectedDates[0];
    let end = document.querySelector("#eventEnd")._flatpickr.selectedDates[0];
    const description = document.getElementById("eventDescription").value;
    const allDay = document.getElementById("eventAllDay").checked;
  
    if (!title || !start) {
      alert("Vui lòng nhập tiêu đề và thời gian bắt đầu");
      return;
    }
    if (allDay) {
      if (!end) {
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      } else {
        const startDay = new Date(start).setHours(0,0,0,0);
        const endDay = new Date(end).setHours(0,0,0,0);
        
        if (startDay === endDay) {
          end = new Date(end);
          end.setDate(end.getDate() + 1);
        }
      }
    }
  
    const eventData = {
      id: eventId || undefined,
      title: title,
      start: start,
      end: end,  
      allDay: allDay,
      backgroundColor: getEventColor(type),
      borderColor: getEventColor(type),
      extendedProps: {
        type: type,
        description: description,
      },
    };
      if (eventId) {
        const existingEvent = calendar.getEventById(eventId);
        if (existingEvent) {
          existingEvent.remove();
        }
      }
      saveEventToDatabase(eventData)
        .then((savedEvent) => {
          calendar.addEvent(savedEvent);
          const eventModal = bootstrap.Modal.getInstance(
            document.getElementById("eventModal")
          );
          eventModal.hide();
        })
        .catch((error) => {
          console.error("Error saving event:", error);
          alert("Có lỗi xảy ra khi lưu sự kiện. Vui lòng thử lại.");
        });
    });
  document
    .getElementById("deleteEventBtn")
    .addEventListener("click", function () {
      const eventId = document.getElementById("eventId").value;

      if (eventId && confirm("Bạn có chắc chắn muốn xóa sự kiện này không?")) {
        fetch("/api/calendar/events/" + eventId, {
          method: "DELETE",
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Không thể xóa sự kiện");
            }
            return response.json();
          })
          .then(() => {
            const existingEvent = calendar.getEventById(eventId);
            if (existingEvent) {
              existingEvent.remove();
            }
            const eventModal = bootstrap.Modal.getInstance(
              document.getElementById("eventModal")
            );
            eventModal.hide();
          })
          .catch((error) => {
            console.error("Error deleting event:", error);
            alert("Có lỗi xảy ra khi xóa sự kiện. Vui lòng thử lại.");
          });
      }
    });
  function displayEventModal(event) {
    document.getElementById("eventId").value = event.id;
    document.getElementById("eventTitle").value = event.title;
    const startPicker = document.querySelector("#eventStart")._flatpickr;
    const endPicker = document.querySelector("#eventEnd")._flatpickr;
  
    startPicker.setDate(event.start);
    
    if (event.end) {
      if (event.allDay) {
        const adjustedEnd = new Date(event.end);
        adjustedEnd.setDate(adjustedEnd.getDate() - 1);
        endPicker.setDate(adjustedEnd);
      } else {
        endPicker.setDate(event.end);
      }
    } else if (event.allDay) {
      endPicker.setDate(event.start);
    } else {
      endPicker.clear();
    }
  
    const allDayCheckbox = document.getElementById("eventAllDay");
    allDayCheckbox.checked = event.allDay;
  
    if (event.allDay) {
      startPicker.set("enableTime", false);
      startPicker.set("dateFormat", "Y-m-d");
      endPicker.set("enableTime", false);
      endPicker.set("dateFormat", "Y-m-d");
    } else {
      startPicker.set("enableTime", true);
      startPicker.set("dateFormat", "Y-m-d H:i");
      endPicker.set("enableTime", true);
      endPicker.set("dateFormat", "Y-m-d H:i");
    }

    if (event.extendedProps) {
      document.getElementById("eventType").value =
        event.extendedProps.type || "study-session";
      document.getElementById("eventDescription").value =
        event.extendedProps.description || "";
    }
    document.getElementById("deleteEventBtn").style.display = "block";
    const eventModal = new bootstrap.Modal(
      document.getElementById("eventModal")
    );
    eventModal.show();
  }

  async function saveEventToDatabase(eventData) {
    let startDate = eventData.start instanceof Date 
    ? eventData.start 
    : new Date(eventData.start);
    
  let endDate = eventData.end instanceof Date 
    ? eventData.end 
    : eventData.end ? new Date(eventData.end) : null;
  if (eventData.allDay && endDate) {
    const displayEndDate = new Date(endDate);
    endDate = new Date(displayEndDate);
    endDate.setDate(endDate.getDate() + 1);
  }
  
  const eventForApi = {
    id: eventData.id,
    title: eventData.title,
    start: startDate.toISOString(),
    end: endDate ? endDate.toISOString() : null,
    allDay: eventData.allDay,
    backgroundColor: eventData.backgroundColor,
    borderColor: eventData.borderColor,
    type: eventData.extendedProps?.type || "study-session",
    description: eventData.extendedProps?.description || "",
  };

    const url = eventData.id
      ? `/api/calendar/events/${eventData.id}`
      : "/api/calendar/events";
    const method = eventData.id ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventForApi),
    });

    if (!response.ok) {
      throw new Error("Failed to save event");
    }

    const savedEvent = await response.json();
    return {
      id: savedEvent.id || savedEvent._id,
      title: savedEvent.title,
      start: savedEvent.start,
      end: savedEvent.end,
      allDay: savedEvent.allDay,
      backgroundColor: savedEvent.backgroundColor,
      borderColor: savedEvent.borderColor,
      extendedProps: {
        type: savedEvent.type,
        description: savedEvent.description,
      },
    };
  }

  function getEventColor(type) {
    const colorMap = {
      "study-session": "#4e73df", 
      assignment: "#36b9cc", 
      "exam-prep": "#f6c23e",
      exam: "#e74a3b", 
      "group-study": "#1cc88a", 
      "study-break": "#858796", 
    };

    return colorMap[type] || colorMap["study-session"];
  }
});
