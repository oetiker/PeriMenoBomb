<script lang="ts">
  import { goto } from '$app/navigation';
  import { todayKey } from '$lib/utils/date';
  import { onMount } from 'svelte';
  onMount(() => goto(`/day/${todayKey()}`, { replaceState: true }));
</script>

<p>Lade…</p>
