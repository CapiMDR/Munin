const { MAX_AMOUNT } = require("./summarizer");

// Tool schemas are kept separate from execution so the LLM contract can grow
// without coupling model prompts to WhatsApp or persistence details.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "summarize_messages",
      description:
        "Summarize the requested number of most recent prior messages in the current group. Use when the user asks Munin to summarize, recap, or explain the latest group conversation.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "integer", minimum: 1, maximum: MAX_AMOUNT, description: "How many recent messages to summarize." },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_message",
      description: "Save the WhatsApp message that the user is replying to under a title.",
      parameters: {
        type: "object",
        properties: { title: { type: "string", description: "A short title for the saved message." } },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_saved_message",
      description: "Show a previously saved WhatsApp message by its title.",
      parameters: {
        type: "object",
        properties: { title: { type: "string", description: "The title of the saved message." } },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_saved_messages",
      description: "List the titles of all WhatsApp messages saved in the current group.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_pending",
      description:
        "Create a pending item for the current group. Optionally assign it a calendar date using dd/mm or Spanish relative dates such as hoy, mañana, ayer, pasado mañana, or a weekday; optionally add a time in HH:mm.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The pending item's text." },
          date: {
            type: "string",
            description: "Optional due date in dd/mm or Spanish relative form, for example mañana, pasado mañana, lunes, or 25/12.",
          },
          time: { type: "string", description: "Optional time in HH:mm format, for example 10:00." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pendings",
      description: "List every pending item in the current group, including its deletion index and optional date.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_pending",
      description: "Edit a pending item by its one-based current list index. Provide at least one field; use null for date or time to clear it.",
      parameters: {
        type: "object",
        properties: {
          index: { type: "integer", minimum: 1, description: "One-based pending index from list_pendings." },
          content: { type: "string", description: "Optional replacement pending text." },
          date: { type: ["string", "null"], description: "Optional replacement date in dd/mm or Spanish relative form; null clears it." },
          time: { type: ["string", "null"], description: "Optional replacement time in HH:mm; null clears it." },
        },
        required: ["index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_pending",
      description: "Delete a pending item in the current group by the one-based index returned by list_pendings.",
      parameters: {
        type: "object",
        properties: { index: { type: "integer", description: "The one-based pending-item index." } },
        required: ["index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description:
        "Create a reminder for the current group. Use either a relative duration such as 30m, 2h, or 1d, or an absolute date and time. Dates accept dd/mm or Spanish relative words such as hoy, mañana, pasado mañana, or a weekday. A request like 'cada 10 minutos' is an indefinite relative recurrence: use duration '10m' and repeat_forever true. Optional repetition is only for relative reminders.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The reminder text." },
          duration: { type: "string", description: "A positive duration using m, h, or d; for example 30m. For 'cada 10 minutos', use 10m." },
          due_date: {
            type: "string",
            description:
              "Use for an absolute reminder date instead of duration. Accepts dd/mm or Spanish relative dates such as hoy, mañana, pasado mañana, or lunes.",
          },
          due_time: { type: "string", description: "24-hour HH:mm time for an absolute reminder; for example 10:00." },
          repeat_count: { type: "integer", description: "Optional total number of deliveries for a recurring reminder. Must be at least 1." },
          repeat_forever: {
            type: "boolean",
            description: "Set true for an indefinite relative recurrence such as 'cada 10 minutos'. Do not combine with repeat_count.",
          },
          weekly_recurrence: {
            type: "object",
            description: "Use only for calendar-based weekly repetition. Do not combine with duration, repeat_count, or repeat_forever.",
            properties: {
              interval: { type: "integer", minimum: 1, description: "Repeat every N weeks; defaults to 1." },
              days_of_week: {
                type: "array",
                items: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
                minItems: 1,
                description: "One or more selected weekdays in English lowercase.",
              },
              time: { type: "string", description: "Required Mexico City delivery time in HH:mm format." },
              start_date: { type: "string", description: "Optional first eligible date in dd/mm or Spanish relative form; defaults to today." },
              until_date: { type: "string", description: "Optional inclusive final date in dd/mm or Spanish relative form." },
              count: { type: "integer", minimum: 1, description: "Optional total number of deliveries, including the first." },
            },
            required: ["days_of_week", "time"],
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List every reminder in the current group, including its deletion index, content, due time, and recurrence details.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description: "Delete a reminder in the current group by the one-based index returned by list_reminders.",
      parameters: {
        type: "object",
        properties: { index: { type: "integer", description: "The one-based reminder index." } },
        required: ["index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_reminder",
      description: "Edit a reminder by its one-based current list index. Provide at least one field. Editing duration, date/time, or recurrence immediately recalculates its next delivery; past dates are valid and will be delivered as soon as Munin can send them.",
      parameters: {
        type: "object",
        properties: {
          index: { type: "integer", minimum: 1, description: "One-based reminder index from list_reminders." },
          content: { type: "string", description: "Optional replacement reminder text." },
          duration: { type: "string", description: "Optional relative delay, such as 30m, 2h, or 1d." },
          due_date: { type: "string", description: "Optional absolute date in dd/mm or Spanish relative form." },
          due_time: { type: "string", description: "Optional absolute time in HH:mm." },
          repeat_count: { type: "integer", minimum: 1, description: "Optional replacement count for a recurring reminder." },
          repeat_forever: { type: "boolean", description: "True makes a recurring reminder repeat forever; false removes recurrence." },
          weekly_recurrence: {
            type: ["object", "null"],
            description: "Optional replacement weekly recurrence; null removes recurrence.",
            properties: {
              interval: { type: "integer", minimum: 1 }, days_of_week: { type: "array", items: { type: "string" } }, time: { type: "string", description: "HH:mm" }, start_date: { type: "string" }, until_date: { type: ["string", "null"] }, count: { type: ["integer", "null"], minimum: 1 },
            },
          },
        },
        required: ["index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_timer",
      description: "Start a one-shot timer for the current group. Use a duration such as 30s, 5m, or 2h.",
      parameters: {
        type: "object",
        properties: {
          duration: { type: "string", description: "A positive timer duration using s, m, or h; for example 30s." },
        },
        required: ["duration"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_help",
      description:
        "Show the same paginated command help as !ayuda. Use this when users ask for help, available commands, or what Munin/the bot does. Use page 1 when no page is requested; valid pages are 1 through 5.",
      parameters: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Optional help page number from 1 to 5. Defaults to 1." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_poll",
      description:
        "Create and send a WhatsApp poll in the current group. Use when the user asks to poll, vote on, or survey the group. If the user gives choices but no explicit question, infer a short natural title from their request; for example, choices 'tacos o pizza' should use '¿Qué prefieren cenar?'.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The poll question or title. Always provide one; infer a concise natural question when the user did not state it explicitly." },
          options: { type: "array", items: { type: "string" }, minItems: 2, description: "At least two answer choices." },
          allow_multiple_answers: { type: "boolean", description: "Whether participants may select more than one choice. Defaults to false." },
        },
        required: ["title", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_custom_command",
      description:
        "Create or update a group-specific custom command that sends a fixed reply. The command name must begin with ! and contain only letters, numbers, underscores, or hyphens.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The custom command name, for example !saludo." },
          reply: { type: "string", description: "The exact fixed reply sent when the custom command is used." },
        },
        required: ["command", "reply"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_user_stats",
      description:
        "Show the requesting user's persisted activity statistics: messages sent, stickers sent, replies to any message, Munin uses, and total messages sent in the current group today.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "send_animal_image",
      description: "Fetch and send one random cat or dog image directly to the current group.",
      parameters: { type: "object", properties: { animal: { type: "string", enum: ["cat", "dog"] } }, required: ["animal"] },
    },
  },
  {
    type: "function",
    function: {
      name: "react_to_message",
      description:
        "React to the invoking message with an appropriate emoji. A reaction may accompany a normal verbal answer; use it when it adds warmth, emphasis, or humor. Never use the feather emoji (🪶).",
      parameters: {
        type: "object",
        properties: { emoji: { type: "string", description: "The reaction emoji to use. Never use 🪶." } },
        required: ["emoji"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get the daily weather forecast at Munin's configured or requested location. Accepts dd/mm or Spanish relative dates such as hoy, mañana, ayer, pasado mañana, or a weekday.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Optional requested date in dd/mm or Spanish relative form, such as mañana or lunes." },
          location: {
            type: "string",
            description: "Optional city or place name, such as San Francisco or París, Francia. Use Munin's configured location when omitted.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_trivia",
      description: "Fetch a group trivia batch and return its first question with shuffled answer options. The question count must be from 1 to 50.",
      parameters: {
        type: "object",
        properties: { amount: { type: "integer", minimum: 1, maximum: 50, description: "Number of questions to fetch for the trivia." } },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_classes",
      description: "List all classes for the current group with their one-based global indexes and bell status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_classes_today",
      description: "List the current group's classes scheduled for today in the Mexico City timezone.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "add_class",
      description: "Add a recurring weekly class to the current group.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The class name." },
          day: { type: "string", description: "Spanish weekday: lunes, martes, miércoles, jueves, viernes, sábado, or domingo." },
          time_range: { type: "string", description: "Class time in HH:mm-HH:mm format, for example 08:00-09:30." },
          classroom: { type: "string", description: "The classroom or location." },
        },
        required: ["name", "day", "time_range", "classroom"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_class",
      description: "Edit an existing class by its one-based global index. Provide at least one field to change.",
      parameters: {
        type: "object",
        properties: {
          index: { type: "integer", description: "The one-based class index from list_classes." },
          name: { type: "string", description: "Optional replacement class name." },
          day: { type: "string", description: "Optional replacement Spanish weekday." },
          time_range: { type: "string", description: "Optional replacement time in HH:mm-HH:mm format." },
          classroom: { type: "string", description: "Optional replacement classroom or location." },
        },
        required: ["index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_class",
      description: "Delete a class by its one-based global index from list_classes.",
      parameters: {
        type: "object",
        properties: { index: { type: "integer", description: "The one-based class index." } },
        required: ["index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_class_bell",
      description: "Enable or disable ten-minute-before-class reminders for the current group.",
      parameters: {
        type: "object",
        properties: { enabled: { type: "boolean", description: "True to enable class bells; false to disable them." } },
        required: ["enabled"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_event",
      description:
        "Create, update, delete, get, list, or RSVP to a group event. Events include automatic group reminders based on their type; reminder rules cannot be customized yet. Use the current one-based list index to update an event, and its simple numeric ID to delete, get, or RSVP.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete", "get", "list", "rsvp"] },
          id: { type: ["string", "integer"], description: "Simple numeric event ID, for delete, get, and rsvp." },
          index: { type: "integer", minimum: 1, description: "One-based current event-list index. Use this to update an event." },
          title: { type: "string", description: "Event title. Required to create an event." },
          description: { type: ["string", "null"], description: "Optional event description. Use null to clear it while updating." },
          type: { type: "string", description: "Optional event type, such as social, birthday, holiday, or meeting. birthday receives birthday reminder defaults; every other type inherits social defaults." },
          start_at: {
            type: "string",
            description: "Required event start. For an event with a time, use a complete Mexico City ISO 8601 timestamp with offset, for example 2026-10-02T20:00:00-06:00. For an all-day event with no supplied time, use date-only YYYY-MM-DD, for example 2026-10-02.",
          },
          location: {
            type: ["object", "null"],
            description: "Optional location. Use null to clear it while updating.",
            properties: {
              name: { type: ["string", "null"], description: "Human-readable venue name." },
              place: { type: ["string", "null"], description: "Optional map/place reference." },
              url: { type: ["string", "null"], description: "Optional http(s) location link." },
            },
          },
          recurrence: {
            type: ["object", "null"],
            description: "Optional recurrence. Use null for a one-shot event or to remove recurrence during an update. until is inclusive and count includes the first occurrence; whichever limit is reached first applies.",
            properties: {
              frequency: { type: "string", enum: ["day", "week", "month", "year"] },
              interval: { type: "integer", minimum: 1, description: "Repeat every N frequency units; defaults to 1." },
              days_of_week: { type: ["array", "null"], items: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] }, description: "Optional stable weekday values, valid only for weekly recurrence." },
              until: { type: ["string", "null"], description: "Optional inclusive final occurrence. Use YYYY-MM-DD for all-day events, otherwise a Mexico City ISO 8601 timestamp." },
              count: { type: ["integer", "null"], minimum: 1, description: "Optional maximum occurrence count, including the first occurrence." },
            },
            required: ["frequency"],
          },
          status: { type: "string", enum: ["going", "maybe", "declined"], description: "RSVP status for the invoking user." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event_countdown",
      description: "Show how much time remains until an event's next occurrence. For recurring events, uses the next occurrence. Use the numeric event ID from the event list.",
      parameters: {
        type: "object",
        properties: { id: { type: ["string", "integer"], description: "Numeric event ID, for example 1." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image and send it to the current WhatsApp group when a user explicitly asks Munin to create, draw, generate, or make an image.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "A detailed visual description of the image to generate.",
          },
        },
        required: ["prompt"],
      },
    },
  },
];

module.exports = { TOOLS };
