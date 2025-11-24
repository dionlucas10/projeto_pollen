document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    try {
      const response = await fetch("https://daccf75f6eef.ngrok-free.app/usuario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nome, email, senha })
      });

      if (!response.ok) {
        const erro = await response.text();
        alert("Erro ao cadastrar: " + erro);
        return;
      }

      const data = await response.json();
      alert("Usuário cadastrado com sucesso!");
      console.log(data);
    } catch (error) {
      alert("Erro de conexão com o servidor: " + error);
    }
  });