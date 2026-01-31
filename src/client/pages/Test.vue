<template>
  <div style="padding: 2rem;">
    <h1>TEST PAGE</h1>
    <p>Se vedi questo, Vue funziona!</p>
    <button @click="count++">Contatore: {{ count }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>
