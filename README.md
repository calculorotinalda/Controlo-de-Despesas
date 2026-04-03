# Atelier Financeiro 💎

Uma aplicação de gestão financeira pessoal sofisticada, com design editorial e foco em privacidade. Esta aplicação foi desenvolvida para funcionar de forma totalmente **offline** e **embedded**, sendo ideal para conversão em APK Android.

## ✨ Funcionalidades
- **Gestão de Transações**: Registo de rendimentos e despesas com categorias personalizadas.
- **Dashboard Visual**: Gráficos de atividade semanal e distribuição de gastos por categoria.
- **Consultor AI**: Insights financeiros inteligentes utilizando o modelo Google Gemini.
- **Privacidade Total**: Todos os dados são armazenados localmente no dispositivo (LocalStorage).
- **Design Premium**: Interface baseada em princípios editoriais, com tipografia refinada e modo offline nativo.

## 📱 Como gerar o APK (Android)
Este projeto utiliza o **Capacitor** para converter a Web App num binário nativo.

1. **Instalar dependências**:
   ```bash
   npm install
   ```
2. **Gerar a Build de Produção**:
   ```bash
   npm run build
   ```
3. **Sincronizar com Android**:
   ```bash
   npx cap add android
   npx cap sync android
   ```
4. **Gerar APK no Android Studio**:
   - Abra o projeto: `npx cap open android`
   - No Android Studio, vá a: **Build > Build APK(s) > Build APK(s)**.

## 🛠️ Tecnologias Utilizadas
- **React 19** + **Vite**
- **Tailwind CSS 4**
- **Capacitor** (para suporte nativo Android)
- **Recharts** (para visualização de dados)
- **Motion** (para animações fluidas)
- **Google Gemini API** (para o consultor financeiro)

## 📄 Licença
Este projeto está sob a licença Apache-2.0.
