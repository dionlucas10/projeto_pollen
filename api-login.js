// Seleciona especificamente o formulário de login
const form = document.querySelector('form[data-view="login"]');

console.log('📋 api-login.js carregado. Form encontrado?', !!form);

if (form) {
  // Cria ou obtém o elemento de mensagem
  let mensagemDiv = form.querySelector('.login-mensagem');
  if (!mensagemDiv) {
    mensagemDiv = document.createElement('div');
    mensagemDiv.className = 'login-mensagem';
    form.insertBefore(mensagemDiv, form.querySelector('.auth-form__submit'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Previne propagação do evento

    const email = form.querySelector('[name="login-email"]').value;
    const senha = form.querySelector('[name="login-password"]').value;

    console.log("Tentando enviar login:", email, senha);

    // Limpa mensagem anterior
    mensagemDiv.textContent = '';
    mensagemDiv.className = 'login-mensagem';

    try {
      console.log('🔵 Enviando POST para /usuario/login:', { email, senha });
      
      const resposta = await fetch('https://375a1444b38a.ngrok-free.app/usuario/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      console.log("📊 Status HTTP:", resposta.status, resposta.statusText);

      const resultado = await resposta.json();
      console.log("🟢 Resposta do servidor:", resultado);

      // Exibe a resposta na tela de login
      if (resposta.ok) {
        mensagemDiv.textContent = 'Login realizado com sucesso!';
        mensagemDiv.className = 'login-mensagem login-mensagem-sucesso';

        // Tenta extrair o nome do objeto retornado pelo servidor
        const nomeUsuario = resultado.nome || resultado.name || resultado.username || (resultado.usuario && resultado.usuario.nome) || email.split('@')[0];
        
        // Tenta extrair o ID do usuário
        const idUsuario = resultado.id || resultado.userId || resultado.usuario?.id;

        console.log('✅ Dados do usuário:', { nomeUsuario, idUsuario });

        try {
          localStorage.setItem('pollen_user_name', nomeUsuario);
          if (idUsuario) {
            localStorage.setItem('pollen_user_id', idUsuario);
            console.log('💾 ID do usuário salvo no localStorage:', idUsuario);
          }
        } catch (e) {
          console.warn('Não foi possível salvar os dados do usuário no localStorage:', e);
        }

        // Redireciona para a página principal após 1 segundo
        setTimeout(() => {
          console.log('🚀 Redirecionando para home.html');
          window.location.href = 'home.html';
        }, 1000);
      } else {
        const mensagemErro = resultado.mensagem || resultado.message || resultado.error || 'Verifique os dados.';
        console.error('❌ Erro no login:', resposta.status, mensagemErro);
        mensagemDiv.textContent = 'Erro no login: ' + mensagemErro;
        mensagemDiv.className = 'login-mensagem login-mensagem-erro';
      }
    } catch (erro) {
      console.error('❌ Erro de conexão:', erro);
      mensagemDiv.textContent = 'Erro ao conectar com o servidor: ' + erro.message;
      mensagemDiv.className = 'login-mensagem login-mensagem-erro';
    }
  });
}

