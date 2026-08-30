export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // TEST
    // =========================

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Telegram bot is running!");
    }

    // =========================
    // WEBHOOK
    // =========================

    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update = await request.json();

        await handleUpdate(update, env);

        return new Response("OK");
      } catch (error) {
        console.error("Webhook error:", error);

        return new Response("Error", {
          status: 500
        });
      }
    }

    return new Response("Not found", {
      status: 404
    });
  }
};


// ======================================================
// HANDLE UPDATE
// ======================================================

async function handleUpdate(update, env) {

  // ====================================================
  // MESSAGE
  // ====================================================

  if (update.message) {

    const message = update.message;
    const chatId = message.chat.id;
    const user = message.from;
    const text = message.text?.trim() || "";

    // Save/update user
    await env.DB.prepare(`
      INSERT INTO users (
        telegram_id,
        username,
        first_name,
        last_name
      )
      VALUES (?, ?, ?, ?)

      ON CONFLICT(telegram_id)
      DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      user.id,
      user.username || null,
      user.first_name || null,
      user.last_name || null
    )
    .run();


    // ==================================================
    // START
    // ==================================================

    if (text === "/start") {
      await showMainMenu(env, chatId);
      return;
    }


    // ==================================================
    // HELP
    // ==================================================

    if (text === "/help") {
      await sendMessage(
        env,
        chatId,
        `🤖 Swissi Tools Bot

/start - Main menu
/help - Help

📝 Notes
Save and manage your notes.

💰 Expenses
Track your expenses.

🧮 Calculator
Calculate arithmetic expressions.

Use /start to open the menu.`
      );

      return;
    }


    // ==================================================
    // CALCULATOR
    // ==================================================

    const calculation = calculate(text);

    if (calculation !== null) {

      await sendMessage(
        env,
        chatId,
        `🧮 Calculator

${text} = ${calculation}`
      );

      return;
    }


    // ==================================================
    // NOTE COMMANDS
    // ==================================================

    if (text.startsWith("/note ")) {

      const content = text.substring(6).trim();

      if (!content) {
        await sendMessage(
          env,
          chatId,
          "Usage:\n\n/note Buy milk"
        );
        return;
      }

      await addNote(
        env,
        user.id,
        content
      );

      await sendMessage(
        env,
        chatId,
        `✅ Note saved!

📝 ${content}`
      );

      return;
    }


    if (text === "/notes") {

      await showNotes(
        env,
        chatId,
        user.id
      );

      return;
    }


    // ==================================================
    // EXPENSE COMMANDS
    // ==================================================

    if (text.startsWith("/expense ")) {

      const data = parseExpense(
        text.substring(9)
      );

      if (!data) {

        await sendMessage(
          env,
          chatId,
          `Usage:

/expense 50000 food

or:

/expense 120000 transport taxi`
        );

        return;
      }


      await addExpense(
        env,
        user.id,
        data.amount,
        data.category,
        data.description
      );


      await sendMessage(
        env,
        chatId,
        `✅ Expense saved!

💰 Amount: ${data.amount}
📂 Category: ${data.category}
📝 ${data.description || "-"}`
      );

      return;
    }


    if (text === "/expenses") {

      await showExpenses(
        env,
        chatId,
        user.id
      );

      return;
    }


    if (text === "/total") {

      await showExpenseTotal(
        env,
        chatId,
        user.id
      );

      return;
    }


    // ==================================================
    // UNKNOWN TEXT
    // ==================================================

    await sendMessage(
      env,
      chatId,
      `I don't recognize that command.

Use /start to open the menu.`
    );

    return;
  }


  // ====================================================
  // BUTTON
  // ====================================================

  if (update.callback_query) {

    const callback = update.callback_query;

    const callbackId = callback.id;
    const chatId = callback.message.chat.id;
    const data = callback.data;

    await answerCallbackQuery(
      env,
      callbackId
    );


    // ==================================================
    // MAIN MENU
    // ==================================================

    if (data === "main") {
      await showMainMenu(env, chatId);
      return;
    }


    // ==================================================
    // NOTES MENU
    // ==================================================

    if (data === "notes") {

      await showNotesMenu(
        env,
        chatId
      );

      return;
    }


    // ==================================================
    // ADD NOTE
    // ==================================================

    if (data === "add_note") {

      await sendMessage(
        env,
        chatId,
        `📝 Add Note

Send:

/note Your note here

Example:

/note Buy milk tomorrow`
      );

      return;
    }


    // ==================================================
    // LIST NOTES
    // ==================================================

    if (data === "list_notes") {

      const user = await getUser(
        env,
        callback.from.id
      );

      if (!user) {
        await sendMessage(
          env,
          chatId,
          "User not found. Send /start first."
        );
        return;
      }

      await showNotes(
        env,
        chatId,
        callback.from.id
      );

      return;
    }


    // ==================================================
    // DELETE NOTE
    // ==================================================

    if (data === "delete_note") {

      await sendMessage(
        env,
        chatId,
        `🗑 Delete Note

Use:

/deletenote ID

Example:

/deletenote 5

Use "My Notes" first to see the ID.`
      );

      return;
    }


    // ==================================================
    // EXPENSE MENU
    // ==================================================

    if (data === "expenses") {

      await showExpensesMenu(
        env,
        chatId
      );

      return;
    }


    // ==================================================
    // ADD EXPENSE
    // ==================================================

    if (data === "add_expense") {

      await sendMessage(
        env,
        chatId,
        `💰 Add Expense

Use:

/expense amount category description

Example:

/expense 50000 food lunch

Or:

/expense 120000 transport taxi`
      );

      return;
    }


    // ==================================================
    // LIST EXPENSES
    // ==================================================

    if (data === "list_expenses") {

      await showExpenses(
        env,
        chatId,
        callback.from.id
      );

      return;
    }


    // ==================================================
    // TOTAL EXPENSES
    // ==================================================

    if (data === "total_expenses") {

      await showExpenseTotal(
        env,
        chatId,
        callback.from.id
      );

      return;
    }


    // ==================================================
    // DELETE EXPENSE
    // ==================================================

    if (data === "delete_expense") {

      await sendMessage(
        env,
        chatId,
        `🗑 Delete Expense

Use:

/deleteexpense ID

Example:

/deleteexpense 5

Use "Expense History" first to see the ID.`
      );

      return;
    }


    // ==================================================
    // CALCULATOR
    // ==================================================

    if (data === "calculator") {

      await sendMessage(
        env,
        chatId,
        `🧮 Calculator

Send a calculation like:

25 × 59

100 / 4

25 + 50

100 - 35

(25 + 5) × 2`
      );

      return;
    }


    // ==================================================
    // UNKNOWN
    // ==================================================

    await sendMessage(
      env,
      chatId,
      "❓ Unknown option."
    );
  }
}



// ======================================================
// MAIN MENU
// ======================================================

async function showMainMenu(
  env,
  chatId
) {

  await sendMessage(
    env,
    chatId,
    `👋 Welcome to Swissi Tools Bot!

Choose a tool:`,
    {
      reply_markup: {
        inline_keyboard: [

          [
            {
              text: "📝 Notes",
              callback_data: "notes"
            },
            {
              text: "💰 Expenses",
              callback_data: "expenses"
            }
          ],

          [
            {
              text: "🧮 Calculator",
              callback_data: "calculator"
            }
          ]

        ]
      }
    }
  );
}



// ======================================================
// NOTES MENU
// ======================================================

async function showNotesMenu(
  env,
  chatId
) {

  await sendMessage(
    env,
    chatId,
    `📝 Notes

What do you want to do?`,
    {
      reply_markup: {
        inline_keyboard: [

          [
            {
              text: "➕ Add Note",
              callback_data: "add_note"
            }
          ],

          [
            {
              text: "📋 My Notes",
              callback_data: "list_notes"
            }
          ],

          [
            {
              text: "🗑 Delete Note",
              callback_data: "delete_note"
            }
          ],

          [
            {
              text: "⬅️ Main Menu",
              callback_data: "main"
            }
          ]

        ]
      }
    }
  );
}



// ======================================================
// ADD NOTE
// ======================================================

async function addNote(
  env,
  telegramId,
  content
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    throw new Error("User not found");
  }


  await env.DB.prepare(`
    INSERT INTO notes (
      user_id,
      title,
      content
    )
    VALUES (?, ?, ?)
  `)
  .bind(
    user.id,
    null,
    content
  )
  .run();
}



// ======================================================
// SHOW NOTES
// ======================================================

async function showNotes(
  env,
  chatId,
  telegramId
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    await sendMessage(
      env,
      chatId,
      "Send /start first."
    );
    return;
  }


  const result = await env.DB.prepare(`
    SELECT
      id,
      content,
      created_at
    FROM notes
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 20
  `)
  .bind(user.id)
  .all();


  if (!result.results.length) {

    await sendMessage(
      env,
      chatId,
      `📝 My Notes

You don't have any notes yet.

Use:

/note Your note`
    );

    return;
  }


  let text = "📝 My Notes\n\n";


  for (const note of result.results) {

    text += `#${note.id}\n`;
    text += `${note.content}\n`;
    text += `📅 ${note.created_at}\n\n`;
  }


  await sendMessage(
    env,
    chatId,
    text
  );
}



// ======================================================
// DELETE NOTE COMMAND
// ======================================================

async function deleteNote(
  env,
  chatId,
  telegramId,
  noteId
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    await sendMessage(
      env,
      chatId,
      "Send /start first."
    );
    return;
  }


  const result = await env.DB.prepare(`
    DELETE FROM notes
    WHERE id = ?
    AND user_id = ?
  `)
  .bind(
    noteId,
    user.id
  )
  .run();


  if (result.meta.changes === 0) {

    await sendMessage(
      env,
      chatId,
      "❌ Note not found."
    );

    return;
  }


  await sendMessage(
    env,
    chatId,
    `✅ Note #${noteId} deleted.`
  );
}



// ======================================================
// EXPENSE MENU
// ======================================================

async function showExpensesMenu(
  env,
  chatId
) {

  await sendMessage(
    env,
    chatId,
    `💰 Expenses

Choose an option:`,
    {
      reply_markup: {
        inline_keyboard: [

          [
            {
              text: "➕ Add Expense",
              callback_data: "add_expense"
            }
          ],

          [
            {
              text: "📋 Expense History",
              callback_data: "list_expenses"
            }
          ],

          [
            {
              text: "📊 Total",
              callback_data: "total_expenses"
            }
          ],

          [
            {
              text: "🗑 Delete Expense",
              callback_data: "delete_expense"
            }
          ],

          [
            {
              text: "⬅️ Main Menu",
              callback_data: "main"
            }
          ]

        ]
      }
    }
  );
}



// ======================================================
// PARSE EXPENSE
// ======================================================

function parseExpense(
  input
) {

  const parts = input
    .trim()
    .split(/\s+/);


  if (parts.length < 2) {
    return null;
  }


  const amount = Number(
    parts[0]
  );


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }


  const category = parts[1];


  const description = parts
    .slice(2)
    .join(" ");


  return {
    amount,
    category,
    description
  };
}



// ======================================================
// ADD EXPENSE
// ======================================================

async function addExpense(
  env,
  telegramId,
  amount,
  category,
  description
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    throw new Error("User not found");
  }


  await env.DB.prepare(`
    INSERT INTO expenses (
      user_id,
      amount,
      currency,
      category,
      description
    )
    VALUES (?, ?, ?, ?, ?)
  `)
  .bind(
    user.id,
    amount,
    "USD",
    category,
    description || null
  )
  .run();
}



// ======================================================
// SHOW EXPENSES
// ======================================================

async function showExpenses(
  env,
  chatId,
  telegramId
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    await sendMessage(
      env,
      chatId,
      "Send /start first."
    );
    return;
  }


  const result = await env.DB.prepare(`
    SELECT
      id,
      amount,
      currency,
      category,
      description,
      created_at
    FROM expenses
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 20
  `)
  .bind(user.id)
  .all();


  if (!result.results.length) {

    await sendMessage(
      env,
      chatId,
      `💰 Expense History

No expenses yet.

Use:

/expense 50000 food lunch`
    );

    return;
  }


  let text = "💰 Expense History\n\n";


  for (const expense of result.results) {

    text += `#${expense.id} — ${expense.amount} ${expense.currency}\n`;
    text += `📂 ${expense.category}\n`;

    if (expense.description) {
      text += `📝 ${expense.description}\n`;
    }

    text += `📅 ${expense.created_at}\n\n`;
  }


  await sendMessage(
    env,
    chatId,
    text
  );
}



// ======================================================
// EXPENSE TOTAL
// ======================================================

async function showExpenseTotal(
  env,
  chatId,
  telegramId
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    await sendMessage(
      env,
      chatId,
      "Send /start first."
    );
    return;
  }


  const result = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(amount), 0) AS total,
      COUNT(*) AS count
    FROM expenses
    WHERE user_id = ?
  `)
  .bind(user.id)
  .first();


  await sendMessage(
    env,
    chatId,
    `📊 Expense Summary

Total: ${result.total} USD
Transactions: ${result.count}`
  );
}



// ======================================================
// DELETE EXPENSE
// ======================================================

async function deleteExpense(
  env,
  chatId,
  telegramId,
  expenseId
) {

  const user = await getUser(
    env,
    telegramId
  );

  if (!user) {
    await sendMessage(
      env,
      chatId,
      "Send /start first."
    );
    return;
  }


  const result = await env.DB.prepare(`
    DELETE FROM expenses
    WHERE id = ?
    AND user_id = ?
  `)
  .bind(
    expenseId,
    user.id
  )
  .run();


  if (result.meta.changes === 0) {

    await sendMessage(
      env,
      chatId,
      "❌ Expense not found."
    );

    return;
  }


  await sendMessage(
    env,
    chatId,
    `✅ Expense #${expenseId} deleted.`
  );
}



// ======================================================
// GET USER
// ======================================================

async function getUser(
  env,
  telegramId
) {

  return await env.DB.prepare(`
    SELECT *
    FROM users
    WHERE telegram_id = ?
  `)
  .bind(telegramId)
  .first();
}



// ======================================================
// CALCULATOR
// ======================================================

function calculate(expression) {
  try {
    if (!expression) {
      return null;
    }

    // Convert common calculator symbols
    let exp = expression
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/,/g, ".")
      .trim();

    // Only allow numbers, operators, decimal points,
    // parentheses and spaces
    if (!/^[0-9+\-*/().\s]+$/.test(exp)) {
      return null;
    }

    // Must contain at least one number
    if (!/[0-9]/.test(exp)) {
      return null;
    }

    // Calculate
    const result = Function(
      `"use strict"; return (${exp})`
    )();

    // Reject invalid results
    if (
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      return null;
    }

    // Clean floating point errors
    return Number(result.toFixed(10));

  } catch (error) {
    console.error("Calculator error:", error);
    return null;
  }
}



// ======================================================
// SEND MESSAGE
// ======================================================

async function sendMessage(
  env,
  chatId,
  text,
  extra = {}
) {

  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...extra
      })
    }
  );


  const result = await response.json();


  if (!result.ok) {
    console.error(
      "Telegram sendMessage error:",
      result
    );
  }


  return result;
}



// ======================================================
// ANSWER CALLBACK
// ======================================================

async function answerCallbackQuery(
  env,
  callbackId
) {

  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        callback_query_id: callbackId
      })
    }
  );


  const result = await response.json();


  if (!result.ok) {
    console.error(
      "Telegram callback error:",
      result
    );
  }


  return result;
                        }
