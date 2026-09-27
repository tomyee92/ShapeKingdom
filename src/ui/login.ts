import { logoPrims } from '../art/buildingArt';
import { primsToSvg } from '../art/svg';
import type { AccountInfo, Backend } from '../backend/backend';
import { esc } from './format';

/** Login / account picker. Calls onDone once an account is logged in. */
export async function showLogin(root: HTMLElement, backend: Backend, onDone: (a: AccountInfo) => void): Promise<void> {
  const accounts = await backend.listAccounts();
  let pinFor: AccountInfo | null = null;
  let error = '';

  const render = () => {
    root.innerHTML = `
      <div class="login">
        <div class="login-card">
          <div class="logo">${primsToSvg(logoPrims(), 190)}</div>
          <h1>Shape Kingdom</h1>
          <p class="tagline">Build a kingdom out of shapes. Stone Age demo.</p>
          ${error ? `<p class="error">${esc(error)}</p>` : ''}
          ${
            pinFor
              ? `<form class="pin-form">
                   <p>PIN for <b>${esc(pinFor.name)}</b></p>
                   <input name="pin" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN" autofocus />
                   <div class="row"><button type="button" class="btn ghost" data-back>Back</button><button class="btn primary">Enter</button></div>
                 </form>`
              : `${
                  accounts.length
                    ? `<h2>Continue as</h2><div class="accounts">${accounts
                        .map((a) => `<button class="btn account" data-id="${a.id}">${esc(a.name)}${a.hasPin ? ' 🔒' : ''}</button>`)
                        .join('')}</div><h2>or create a new ruler</h2>`
                    : '<h2>Create your ruler</h2>'
                }
                <form class="create-form">
                  <input name="name" maxlength="16" placeholder="Ruler name" autocomplete="off" required />
                  <input name="pin" inputmode="numeric" maxlength="6" placeholder="PIN (optional, 4–6 digits)" autocomplete="off" />
                  <button class="btn primary">Create &amp; play</button>
                </form>`
          }
          <p class="note">Demo login — saved in this browser only.</p>
        </div>
      </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const acc = accounts.find((a) => a.id === btn.dataset.id)!;
        if (acc.hasPin) {
          pinFor = acc;
          error = '';
          render();
          return;
        }
        onDone(await backend.logIn(acc.id));
      }),
    );
    root.querySelector('[data-back]')?.addEventListener('click', () => {
      pinFor = null;
      error = '';
      render();
    });
    root.querySelector<HTMLFormElement>('.pin-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = new FormData(e.target as HTMLFormElement).get('pin') as string;
      try {
        onDone(await backend.logIn(pinFor!.id, pin));
      } catch (err) {
        error = (err as Error).message;
        render();
      }
    });
    root.querySelector<HTMLFormElement>('.create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      try {
        onDone(await backend.createAccount(fd.get('name') as string, fd.get('pin') as string));
      } catch (err) {
        error = (err as Error).message;
        render();
      }
    });
  };

  render();
}
