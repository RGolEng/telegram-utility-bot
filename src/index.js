export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test page
    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Telegram bot is running!");
    }

    // Telegram webhook
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update = await request.json();

        await handleUpdate(update, env);

        return new Response("OK");
      } catch (error) {
        console.error(error);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};


async function handleUpdate(update, env) {
  if (!update.message) return;

  const message = update.message;
  const chatId = message.chat.id;
  const user = message.from;

  // Save user in D1
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
      last_name = excluded.last_name
  `)
  .bind(
    user.id,
    user.username || null,
    user.first_name || null,
    user.last_name || null
  )
  .run();


  const text = message.text || "";


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


  if (text === "/help") {
    await sendMessage(
      env,
      chatId,
      "Commands:\n\n/start - Start bot\n/help - Help"
    );

    return;
  }


  await sendMessage(
    env,
    chatId,
    `You said:\n\n${text}`
  );
}


async function sendMessage(env, chatId, text, extra = {}) {
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

  return response.json();
}
