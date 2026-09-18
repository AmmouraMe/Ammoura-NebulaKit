import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MotionEditor from './MotionEditor.svelte';
import type { ComponentConfig } from '$lib/types/pages';

/** Render the editor and capture what it dispatches. */
function setup(config: ComponentConfig = {}, componentType = 'text') {
  const updates: ComponentConfig[] = [];
  const { component } = render(MotionEditor, { props: { config, componentType } });
  component.$on('update', (e: CustomEvent<ComponentConfig>) => updates.push(e.detail));
  return { updates };
}

describe('MotionEditor', () => {
  it('offers every preset the runtime accepts, plus a way to clear it', async () => {
    setup();
    // A name missing here is a capability nobody can reach. "No entrance" rather
    // than "None" because the ambient group has a None too, and two buttons with
    // one name are indistinguishable to anyone not looking at the headings.
    for (const label of [
      'No entrance',
      'Fade',
      'Up',
      'Down',
      'Left',
      'Right',
      'Zoom in',
      'Zoom out',
      'Blur',
      'Rise'
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('writes only the preset, so the runtime defaults stay the single definition', async () => {
    // A config that spells out every default cannot follow a change to one.
    const { updates } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Up' }));
    expect(updates.at(-1)?.motion).toEqual({ preset: 'fade-up' });
  });

  it('removes the key entirely when cleared, rather than storing an empty object', async () => {
    const { updates } = setup({ motion: { preset: 'fade', duration: 900 } });
    await userEvent.click(screen.getByRole('button', { name: 'No entrance' }));
    expect(updates.at(-1)).not.toHaveProperty('motion');
  });

  it('keeps the other fields when the preset is changed', async () => {
    const { updates } = setup({ motion: { preset: 'fade', duration: 900 } });
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(updates.at(-1)?.motion).toEqual({ preset: 'zoom-in', duration: 900 });
  });

  it('hides the timing fields until there is something to time', () => {
    setup();
    expect(screen.queryByLabelText('Duration (ms)')).not.toBeInTheDocument();
  });

  it('shows travel only for the presets whose from-state actually travels', () => {
    setup({ motion: { preset: 'fade-up' } });
    expect(screen.getByLabelText('Travel (px)')).toBeInTheDocument();
  });

  it('hides travel for a preset that does not move, where it would do nothing', () => {
    setup({ motion: { preset: 'fade' } });
    expect(screen.queryByLabelText('Travel (px)')).not.toBeInTheDocument();
  });

  it('hides the scroll-only fields when the entrance fires on load', () => {
    // A threshold and a replay toggle are meaningless without an observer.
    setup({ motion: { preset: 'fade', trigger: 'load' } });
    expect(screen.queryByText('Only the first time')).not.toBeInTheDocument();
  });

  it('offers stagger on a container, which is the only thing with children to stagger', () => {
    setup({ motion: { preset: 'fade' } }, 'container');
    expect(screen.getByText(/Stagger children/)).toBeInTheDocument();
  });

  it('does not offer stagger on a leaf component', () => {
    setup({ motion: { preset: 'fade' } }, 'text');
    expect(screen.queryByText(/Stagger children/)).not.toBeInTheDocument();
  });

  it('drops the parallax key at zero instead of storing a no-op effect', async () => {
    const { updates } = setup({ scrollEffect: { parallax: 20 } });
    const slider = screen.getByLabelText('Drift') as HTMLInputElement;
    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(updates.at(-1)).not.toHaveProperty('scrollEffect');
  });

  it('gives the preview tile the same class and variables the real page uses', () => {
    // If the preview diverged from motionStyle() it would be a drawing of the
    // motion rather than the motion, and could agree with nothing.
    const { container } = render(MotionEditor, {
      props: { config: { motion: { preset: 'fade-up', distance: 40 } }, componentType: 'text' }
    });
    const tile = container.querySelector('.preview-tile');
    expect(tile?.classList.contains('motion')).toBe(true);
    expect(tile?.getAttribute('style')).toContain(
      '--motion-from-transform: translate3d(0, 40px, 0)'
    );
  });

  it('warns about the ambient presets that need something of the element', async () => {
    setup({ ambient: { name: 'sheen' } });
    expect(screen.getByText(/Needs a gradient background/)).toBeInTheDocument();
  });

  it('dispatches once per edit, not on every keystroke of a rebuild', async () => {
    const onUpdate = vi.fn();
    const { component } = render(MotionEditor, { props: { config: {}, componentType: 'text' } });
    component.$on('update', onUpdate);
    await userEvent.click(screen.getByRole('button', { name: 'Fade' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
