import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import glsl from 'vite-plugin-glsl'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGithubPagesBuild = process.env.GITHUB_PAGES === 'true'
const base = isGithubPagesBuild && repoName ? `/${repoName}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    vue(),
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
    }),
  ],
})
