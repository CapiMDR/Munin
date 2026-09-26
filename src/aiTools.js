const { MAX_AMOUNT } = require("./summarizer");

// Tool schemas are kept separate from execution so the LLM contract can grow
// without coupling model prompts to WhatsApp or persistence details.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "summarize_messages",
      description: "Summarize the requested number of most recent prior messages in the current group. Use when the user asks Munin to summarize, recap, or explain the latest group conversation.",
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
      description: "Create a pending item for the current group. Optionally assign it a calendar date using dd/mm or Spanish relative dates such as hoy, mañana, ayer, pasado mañana, or a weekday; optionally add a time in HH:mm.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The pending item's text." },
          date: { type: "string", description: "Optional due date in dd/mm or Spanish relative form, for example mañana, pasado mañana, lunes, or 25/12." },
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
      description: "Create a reminder for the current group. Use either a relative duration such as 30m, 2h, or 1d, or an absolute date and time. Dates accept dd/mm or Spanish relative words such as hoy, mañana, pasado mañana, or a weekday. Optional repetition is only for relative reminders.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The reminder text." },
          duration: { type: "string", description: "A positive duration using m, h, or d; for example 30m." },
          due_date: { type: "string", description: "Use for an absolute reminder date instead of duration. Accepts dd/mm or Spanish relative dates such as hoy, mañana, pasado mañana, or lunes." },
          due_time: { type: "string", description: "24-hour HH:mm time for an absolute reminder; for example 10:00." },
          repeat_count: { type: "integer", description: "Optional total number of deliveries for a recurring reminder. Must be at least 1." },
          repeat_forever: { type: "boolean", description: "Set true to repeat indefinitely. Do not combine with repeat_count." },
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
      description: "Show the same paginated command help as !ayuda. Use this when users ask for help, available commands, or what Munin/the bot does. Use page 1 when no page is requested; valid pages are 1 through 5.",
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
      name: "create_custom_command",
      description: "Create or update a group-specific custom command that sends a fixed reply. The command name must begin with ! and contain only letters, numbers, underscores, or hyphens.",
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
      description: "Show the requesting user's persisted activity statistics: messages sent, stickers sent, replies to any message, Munin uses, and total messages sent in the current group today.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "send_cat_image",
      description: "Fetch and send one random cat image directly to the current group.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "send_dog_image",
      description: "Fetch and send one random dog image directly to the current group.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the daily weather forecast at Munin's configured or requested location. Accepts dd/mm or Spanish relative dates such as hoy, mañana, ayer, pasado mañana, or a weekday.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Optional requested date in dd/mm or Spanish relative form, such as mañana or lunes." },
          location: { type: "string", description: "Optional city or place name, such as San Francisco or París, Francia. Use Munin's configured location when omitted." },
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
];

module.exports = { TOOLS };
