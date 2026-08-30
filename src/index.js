export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // TEST PAGE
    // =========================

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Telegram bot is running!");
    }


    // =========================
    // TELEGRAM WEBHOOK
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
// HANDLE TELEGRAM UPDATE
// ======================================================

async function handleUpdate(update, env) {


  // ====================================================
  // NORMAL MESSAGE
  // ====================================================

  if (update.message) {

    const message = update.message;
    const chatId = message.chat.id;
    const user = message.from;


    // --------------------------------------------------
    // SAVE USER IN D1
    // --------------------------------------------------

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


    const text = message.text || "";


    // ==================================================
    // /START
    // ==================================================

    if (text === "/start") {

      await sendMessage(
        env,
        chatId,
        "👋 Welcome!\n\nChoose an option:",
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

      return;
    }


    // ==================================================
    // /HELP
    // ==================================================

    if (text === "/help") {

      await sendMessage(
        env,
        chatId,
        "Commands:\n\n/start - Start bot\n/help - Help"
      );

      return;
    }


    // ==================================================
    // NORMAL TEXT
    // ==================================================

    await sendMessage(
      env,
      chatId,
      `You said:\n\n${text}`
    );

    return;
  }



  // ====================================================
  // BUTTON / CALLBACK QUERY
  // ====================================================

  if (update.callback_query) {

    const callback = update.callback_query;

    const callbackId = callback.id;

    const chatId = callback.message.chat.id;

    const data = callback.data;


    // --------------------------------------------------
    // REMOVE TELEGRAM BUTTON LOADING
    // --------------------------------------------------

    await answerCallbackQuery(
      env,
      callbackId
    );


    // ==================================================
    // NOTES BUTTON
    // ==================================================

    if (data === "notes") {

      await sendMessage(
        env,
        chatId,
        "📝 Notes\n\nNotes feature is ready to build."
      );

      return;
    }


    // ==================================================
    // EXPENSES BUTTON
    // ==================================================

    if (data === "expenses") {

      await sendMessage(
        env,
        chatId,
        "💰 Expenses\n\nExpense tracker is ready to build."
      );

      return;
    }


    // ==================================================
    // CALCULATOR BUTTON
    // ==================================================

    if (data === "calculator") {

      await sendMessage(
        env,
        chatId,
        "🧮 Calculator\n\nSend me a calculation like:\n\n25 + 50 * 2"
      );

      return;
    }


    // ==================================================
    // UNKNOWN BUTTON
    // ==================================================

    await sendMessage(
      env,
      chatId,
      "❓ Unknown option."
    );

    return;
  }
}



// ======================================================
// SEND TELEGRAM MESSAGE
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
        text: text,
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
// ANSWER CALLBACK QUERY
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
