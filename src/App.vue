<template>
  <div class="layout">
    <header class="header">
      <h1>Heart Beat</h1>
      <nav class="nav">
        <RouterLink to="/" class="link">Home</RouterLink>
        <RouterLink to="/about" class="link">About</RouterLink>
        <RouterLink to="/heartTest" class="link">HeartTest</RouterLink>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 24px;
}

.nav {
  display: flex;
  gap: 12px;
}

.link {
  padding: 6px 10px;
  border-radius: 8px;
  color: #334155;
  font-weight: 600;
}

.link.router-link-active {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.main {
  min-height: 240px;
}
</style>
